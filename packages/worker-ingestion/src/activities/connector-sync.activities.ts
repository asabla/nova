import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { putObjectBuffer } from "@nova/worker-shared/minio";
import { deletePointsByFilter, COLLECTIONS } from "@nova/worker-shared/qdrant";
import {
  knowledgeConnectors,
  knowledgeDocuments,
  knowledgeCollections,
} from "@nova/shared/schemas";
import { files } from "@nova/shared/schema";
import {
  getAppToken,
  getDriveItemsDelta,
  downloadDriveItem,
  isDriveItemFile,
  isDriveItemDeleted,
  getChannelMessagesDelta,
  stripHtml,
  listSiteDrives,
  type GraphDriveItem,
  type GraphMessage,
} from "@nova/worker-shared/microsoft-graph";
import type { ConnectorSyncInput } from "../workflows/connector-sync";
import { syncRepoFiles } from "./repo-sync.activities";

// ── Status Updates ──

export async function updateConnectorSyncStatus(
  connectorId: string,
  status: string,
  error?: string,
): Promise<void> {
  await db
    .update(knowledgeConnectors)
    .set({
      lastSyncStatus: status,
      lastSyncError: error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeConnectors.id, connectorId));
}

export async function updateConnectorSyncState(
  connectorId: string,
  state: {
    lastSyncStatus: string;
    lastSyncAt: string;
    deltaCursor: string | null;
    syncedDocumentCount: number;
  },
): Promise<void> {
  await db
    .update(knowledgeConnectors)
    .set({
      lastSyncStatus: state.lastSyncStatus,
      lastSyncAt: new Date(state.lastSyncAt),
      deltaCursor: state.deltaCursor,
      syncedDocumentCount: state.syncedDocumentCount,
      lastSyncError: null,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeConnectors.id, connectorId));
}

// ── Find Connectors Due for Sync (used by dispatch workflow) ──

export async function findConnectorsDueForSync(): Promise<
  Array<{ id: string; orgId: string; knowledgeCollectionId: string }>
> {
  const rows = await db
    .select({
      id: knowledgeConnectors.id,
      orgId: knowledgeConnectors.orgId,
      knowledgeCollectionId: knowledgeConnectors.knowledgeCollectionId,
    })
    .from(knowledgeConnectors)
    .where(
      and(
        eq(knowledgeConnectors.syncEnabled, true),
        isNull(knowledgeConnectors.deletedAt),
        sql`(${knowledgeConnectors.lastSyncAt} IS NULL OR ${knowledgeConnectors.lastSyncAt} + (${knowledgeConnectors.syncIntervalMinutes} || ' minutes')::interval < now())`,
      ),
    );

  return rows;
}

// ── Main Sync Activity ──

export async function syncConnectorDocuments(
  input: ConnectorSyncInput,
): Promise<{ deltaCursor: string | null; syncedDocumentCount: number }> {
  // Load connector with credentials
  const [connector] = await db
    .select()
    .from(knowledgeConnectors)
    .where(
      and(
        eq(knowledgeConnectors.id, input.connectorId),
        isNull(knowledgeConnectors.deletedAt),
      ),
    );

  if (!connector) throw new Error(`Connector ${input.connectorId} not found`);

  const clientSecret = Buffer.from(connector.clientSecretEncrypted, "base64").toString("utf-8");
  const token = await getAppToken(connector.tenantId, connector.clientId, clientSecret);

  switch (connector.provider) {
    case "sharepoint":
      return syncSharePoint(token, connector, input);
    case "onedrive":
      return syncOneDrive(token, connector, input);
    case "teams":
      return syncTeams(token, connector, input);
    case "github":
    case "gitlab":
    case "bitbucket":
    case "git":
      return syncRepoFiles(input);
    default:
      throw new Error(`Unknown provider: ${connector.provider}`);
  }
}

// ── SharePoint Sync ──

async function syncSharePoint(
  token: string,
  connector: typeof knowledgeConnectors.$inferSelect,
  input: ConnectorSyncInput,
) {
  // SharePoint resourceId is a siteId — get the default document library drive
  const drives = await listSiteDrives(token, connector.resourceId);
  const targetDrive = connector.resourcePath
    ? drives.find((d) => d.name === connector.resourcePath || d.id === connector.resourcePath)
    : drives[0];

  if (!targetDrive) throw new Error("No document library found for this SharePoint site");

  return syncDriveItems(token, targetDrive.id, connector, input);
}

// ── OneDrive Sync ──

async function syncOneDrive(
  token: string,
  connector: typeof knowledgeConnectors.$inferSelect,
  input: ConnectorSyncInput,
) {
  // OneDrive resourceId is a driveId directly
  return syncDriveItems(token, connector.resourceId, connector, input);
}

// ── Shared Drive Items Sync (used by SharePoint + OneDrive) ──

async function syncDriveItems(
  token: string,
  driveId: string,
  connector: typeof knowledgeConnectors.$inferSelect,
  input: ConnectorSyncInput,
) {
  const delta = await getDriveItemsDelta(token, driveId, connector.deltaCursor);

  let syncedCount = connector.syncedDocumentCount ?? 0;

  for (const item of delta.items) {
    if (isDriveItemDeleted(item as GraphDriveItem & { deleted?: { state: string } })) {
      // Handle deletion
      await removeDocumentByExternalId(input.connectorId, item.id, input.orgId);
      syncedCount = Math.max(0, syncedCount - 1);
      continue;
    }

    if (!isDriveItemFile(item)) continue; // Skip folders

    // Apply folder filter
    if (connector.folderFilter && item.parentReference?.path) {
      const parentPath = item.parentReference.path;
      if (!parentPath.includes(connector.folderFilter)) continue;
    }

    // Apply file type filter
    const fileTypeFilter = connector.fileTypeFilter as string[] | null;
    if (fileTypeFilter && fileTypeFilter.length > 0 && item.file?.mimeType) {
      if (!fileTypeFilter.includes(item.file.mimeType)) continue;
    }

    // Download and store
    const buffer = await downloadDriveItem(token, driveId, item.id);
    const contentType = item.file?.mimeType ?? "application/octet-stream";
    const storagePath = `${input.orgId}/connectors/${input.connectorId}/${item.id}/${item.name}`;

    await putObjectBuffer(storagePath, buffer, contentType);

    // Create file record
    const [fileRecord] = await db
      .insert(files)
      .values({
        orgId: input.orgId,
        userId: connector.createdBy,
        filename: item.name,
        contentType,
        sizeBytes: item.size ?? buffer.length,
        storagePath,
        storageBucket: process.env.MINIO_BUCKET ?? "nova-files",
        metadata: {
          provider: connector.provider,
          connectorId: input.connectorId,
          driveId,
          driveItemId: item.id,
          webUrl: item.webUrl,
          lastModified: item.lastModifiedDateTime,
        },
      })
      .returning();

    // Upsert knowledge document
    await upsertKnowledgeDocument({
      orgId: input.orgId,
      collectionId: input.collectionId,
      connectorId: input.connectorId,
      externalId: item.id,
      title: item.name,
      fileId: fileRecord.id,
      sourceUrl: item.webUrl ?? null,
      metadata: {
        provider: connector.provider,
        driveId,
        lastModified: item.lastModifiedDateTime,
      },
    });

    syncedCount++;
  }

  // Trigger ingestion for all pending documents from this connector
  await triggerPendingIngestions(input.connectorId, input.orgId, input.collectionId);

  return { deltaCursor: delta.deltaLink, syncedDocumentCount: syncedCount };
}

// ── Teams Sync ──

async function syncTeams(
  token: string,
  connector: typeof knowledgeConnectors.$inferSelect,
  input: ConnectorSyncInput,
) {
  const channelId = connector.resourcePath;
  if (!channelId) throw new Error("Teams connector requires a channelId in resourcePath");

  const delta = await getChannelMessagesDelta(
    token,
    connector.resourceId, // teamId
    channelId,
    connector.deltaCursor,
  );

  // Filter out deleted messages and system messages
  const validMessages = delta.items.filter(
    (m) => !m.deletedDateTime && m.body?.content,
  );

  if (validMessages.length === 0) {
    return {
      deltaCursor: delta.deltaLink,
      syncedDocumentCount: connector.syncedDocumentCount ?? 0,
    };
  }

  // Aggregate messages into a single document per channel
  const content = validMessages
    .map((m) => {
      const author = m.from?.user?.displayName ?? "Unknown";
      const time = m.createdDateTime ?? "";
      const body =
        m.body?.contentType === "html"
          ? stripHtml(m.body.content)
          : m.body?.content ?? "";
      return `[${time}] ${author}:\n${body}`;
    })
    .join("\n\n---\n\n");

  const title = `#${connector.resourceName ?? channelId} — Messages`;
  const externalId = `teams-channel-${channelId}`;

  await upsertKnowledgeDocument({
    orgId: input.orgId,
    collectionId: input.collectionId,
    connectorId: input.connectorId,
    externalId,
    title,
    content,
    sourceUrl: null,
    metadata: {
      provider: "teams",
      teamId: connector.resourceId,
      channelId,
      messageCount: validMessages.length,
      dateRange: {
        from: validMessages[0]?.createdDateTime,
        to: validMessages[validMessages.length - 1]?.createdDateTime,
      },
    },
  });

  await triggerPendingIngestions(input.connectorId, input.orgId, input.collectionId);

  return { deltaCursor: delta.deltaLink, syncedDocumentCount: 1 };
}

// ── Helpers ──

async function upsertKnowledgeDocument(data: {
  orgId: string;
  collectionId: string;
  connectorId: string;
  externalId: string;
  title: string;
  fileId?: string;
  content?: string;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
}) {
  // Check if document already exists for this connector + externalId
  const [existing] = await db
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.connectorId, data.connectorId),
        eq(knowledgeDocuments.externalId, data.externalId),
        isNull(knowledgeDocuments.deletedAt),
      ),
    );

  if (existing) {
    // Update existing — reset status to pending for re-ingestion
    await db
      .update(knowledgeDocuments)
      .set({
        title: data.title,
        fileId: data.fileId ?? undefined,
        content: data.content ?? undefined,
        sourceUrl: data.sourceUrl,
        metadata: data.metadata,
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, existing.id));
  } else {
    // Insert new
    await db.insert(knowledgeDocuments).values({
      knowledgeCollectionId: data.collectionId,
      orgId: data.orgId,
      connectorId: data.connectorId,
      externalId: data.externalId,
      title: data.title,
      fileId: data.fileId,
      content: data.content,
      sourceUrl: data.sourceUrl,
      metadata: data.metadata,
      status: "pending",
    });
  }
}

async function removeDocumentByExternalId(
  connectorId: string,
  externalId: string,
  orgId: string,
) {
  const [doc] = await db
    .select({ id: knowledgeDocuments.id, knowledgeCollectionId: knowledgeDocuments.knowledgeCollectionId })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.connectorId, connectorId),
        eq(knowledgeDocuments.externalId, externalId),
        isNull(knowledgeDocuments.deletedAt),
      ),
    );

  if (!doc) return;

  // Soft-delete
  await db
    .update(knowledgeDocuments)
    .set({ deletedAt: new Date() })
    .where(eq(knowledgeDocuments.id, doc.id));

  // Delete vectors from Qdrant
  try {
    await deletePointsByFilter(COLLECTIONS.KNOWLEDGE_CHUNKS, {
      must: [
        { key: "orgId", match: { value: orgId } },
        { key: "documentId", match: { value: doc.id } },
      ],
    });
  } catch (err) {
    console.warn(`Failed to delete Qdrant vectors for document ${doc.id}:`, err);
  }
}

async function triggerPendingIngestions(
  connectorId: string,
  orgId: string,
  collectionId: string,
) {
  // Find all pending documents for this connector
  const pendingDocs = await db
    .select({ id: knowledgeDocuments.id, fileId: knowledgeDocuments.fileId, sourceUrl: knowledgeDocuments.sourceUrl })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.connectorId, connectorId),
        eq(knowledgeDocuments.status, "pending"),
        isNull(knowledgeDocuments.deletedAt),
      ),
    );

  // Import temporal client lazily to avoid circular deps in workflow context
  const { Connection, Client } = await import("@temporalio/client");
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "temporal:7233",
  });
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
  });

  for (const doc of pendingDocs) {
    try {
      await client.workflow.start("documentIngestionWorkflow", {
        taskQueue: "nova-ingestion",
        workflowId: `doc-ingest-${doc.id}`,
        args: [{
          orgId,
          collectionId,
          documentId: doc.id,
          fileId: doc.fileId ?? undefined,
          sourceUrl: doc.sourceUrl ?? undefined,
        }],
      });
    } catch {
      // Workflow may already be running — skip
    }
  }

  await connection.close();
}
