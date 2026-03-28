import { eq, and, isNull, desc, sql, lt } from "drizzle-orm";
import { TASK_QUEUES } from "@nova/shared/constants";
import { db } from "../lib/db";
import { knowledgeConnectors, knowledgeCollections } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";
import { getTemporalClient } from "../lib/temporal";

// ── Helpers ──

function encryptSecret(secret: string): string {
  return Buffer.from(secret).toString("base64");
}

function decryptSecret(encrypted: string): string {
  return Buffer.from(encrypted, "base64").toString("utf-8");
}

// ── Service ──

export const knowledgeConnectorService = {
  async listConnectors(orgId: string, collectionId?: string) {
    const conditions = [
      eq(knowledgeConnectors.orgId, orgId),
      isNull(knowledgeConnectors.deletedAt),
    ];
    if (collectionId) {
      conditions.push(eq(knowledgeConnectors.knowledgeCollectionId, collectionId));
    }

    const rows = await db
      .select()
      .from(knowledgeConnectors)
      .where(and(...conditions))
      .orderBy(desc(knowledgeConnectors.createdAt));

    // Strip encrypted secrets from response
    return rows.map(({ clientSecretEncrypted: _, ...rest }) => rest);
  },

  async getConnector(orgId: string, connectorId: string) {
    const [connector] = await db
      .select()
      .from(knowledgeConnectors)
      .where(
        and(
          eq(knowledgeConnectors.id, connectorId),
          eq(knowledgeConnectors.orgId, orgId),
          isNull(knowledgeConnectors.deletedAt),
        ),
      );

    if (!connector) throw AppError.notFound("Connector not found");
    const { clientSecretEncrypted: _, ...safe } = connector;
    return safe;
  },

  /** Get connector with decrypted secret (internal use only — for sync workflows) */
  async getConnectorWithSecret(orgId: string, connectorId: string) {
    const [connector] = await db
      .select()
      .from(knowledgeConnectors)
      .where(
        and(
          eq(knowledgeConnectors.id, connectorId),
          eq(knowledgeConnectors.orgId, orgId),
          isNull(knowledgeConnectors.deletedAt),
        ),
      );

    if (!connector) throw AppError.notFound("Connector not found");
    return {
      ...connector,
      clientSecret: decryptSecret(connector.clientSecretEncrypted),
    };
  },

  async createConnector(
    orgId: string,
    userId: string,
    data: {
      knowledgeCollectionId: string;
      provider: string;
      tenantId: string;
      clientId: string;
      clientSecret: string;
      resourceId: string;
      resourcePath?: string;
      resourceName?: string;
      syncEnabled?: boolean;
      syncIntervalMinutes?: number;
      folderFilter?: string;
      fileTypeFilter?: string[];
      metadata?: Record<string, unknown>;
    },
  ) {
    // Verify collection belongs to org
    const [collection] = await db
      .select()
      .from(knowledgeCollections)
      .where(
        and(
          eq(knowledgeCollections.id, data.knowledgeCollectionId),
          eq(knowledgeCollections.orgId, orgId),
        ),
      );
    if (!collection) throw AppError.notFound("Collection not found");

    // Test credentials — only for Microsoft 365 providers (git uses token auth validated at route level)
    const gitProviders = ["github", "gitlab", "bitbucket", "git"];
    if (!gitProviders.includes(data.provider)) {
      await this.testCredentials(data.tenantId, data.clientId, data.clientSecret);
    }

    const { clientSecret, fileTypeFilter, ...rest } = data;

    const [connector] = await db
      .insert(knowledgeConnectors)
      .values({
        orgId,
        createdBy: userId,
        ...rest,
        clientSecretEncrypted: encryptSecret(clientSecret),
        fileTypeFilter: fileTypeFilter ? JSON.stringify(fileTypeFilter) : undefined,
      })
      .returning();

    // Update collection source
    await db
      .update(knowledgeCollections)
      .set({ source: data.provider, updatedAt: new Date() })
      .where(eq(knowledgeCollections.id, data.knowledgeCollectionId));

    const { clientSecretEncrypted: _, ...safe } = connector;
    return safe;
  },

  async updateConnector(
    orgId: string,
    connectorId: string,
    data: {
      resourceId?: string;
      resourcePath?: string;
      resourceName?: string;
      syncEnabled?: boolean;
      syncIntervalMinutes?: number;
      folderFilter?: string | null;
      fileTypeFilter?: string[] | null;
      clientSecret?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.resourceId !== undefined) {
      updateData.resourceId = data.resourceId;
      // Reset delta cursor when resource changes
      updateData.deltaCursor = null;
    }
    if (data.resourcePath !== undefined) updateData.resourcePath = data.resourcePath;
    if (data.resourceName !== undefined) updateData.resourceName = data.resourceName;
    if (data.syncEnabled !== undefined) updateData.syncEnabled = data.syncEnabled;
    if (data.syncIntervalMinutes !== undefined) updateData.syncIntervalMinutes = data.syncIntervalMinutes;
    if (data.folderFilter !== undefined) updateData.folderFilter = data.folderFilter;
    if (data.fileTypeFilter !== undefined) {
      updateData.fileTypeFilter = data.fileTypeFilter ? JSON.stringify(data.fileTypeFilter) : null;
    }
    if (data.clientSecret) {
      updateData.clientSecretEncrypted = encryptSecret(data.clientSecret);
    }
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const [connector] = await db
      .update(knowledgeConnectors)
      .set(updateData)
      .where(
        and(
          eq(knowledgeConnectors.id, connectorId),
          eq(knowledgeConnectors.orgId, orgId),
          isNull(knowledgeConnectors.deletedAt),
        ),
      )
      .returning();

    if (!connector) throw AppError.notFound("Connector not found");
    const { clientSecretEncrypted: _, ...safe } = connector;
    return safe;
  },

  async deleteConnector(orgId: string, connectorId: string) {
    const [connector] = await db
      .update(knowledgeConnectors)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(knowledgeConnectors.id, connectorId),
          eq(knowledgeConnectors.orgId, orgId),
          isNull(knowledgeConnectors.deletedAt),
        ),
      )
      .returning();

    if (!connector) throw AppError.notFound("Connector not found");
  },

  async testCredentials(tenantId: string, clientId: string, clientSecret: string) {
    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    });

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw AppError.badRequest(`Azure AD authentication failed: ${text}`);
    }

    const data = (await res.json()) as { access_token: string };
    return { success: true, accessToken: data.access_token };
  },

  async testConnection(orgId: string, connectorId: string) {
    const connector = await this.getConnectorWithSecret(orgId, connectorId);

    // Step 1: Acquire token
    const { accessToken } = await this.testCredentials(
      connector.tenantId,
      connector.clientId,
      connector.clientSecret,
    );

    // Step 2: Test Graph API access based on provider
    let testUrl: string;
    switch (connector.provider) {
      case "sharepoint":
        testUrl = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(connector.resourceId)}`;
        break;
      case "onedrive":
        testUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(connector.resourceId)}`;
        break;
      case "teams":
        testUrl = `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(connector.resourceId)}`;
        break;
      default:
        throw AppError.badRequest(`Unknown provider: ${connector.provider}`);
    }

    const graphRes = await fetch(testUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!graphRes.ok) {
      const text = await graphRes.text();
      return {
        success: false,
        message: `Graph API returned ${graphRes.status}: ${text}`,
      };
    }

    const data = (await graphRes.json()) as Record<string, unknown>;
    return {
      success: true,
      message: `Connected to ${(data.displayName as string) ?? (data.name as string) ?? connector.resourceId}`,
      details: { displayName: data.displayName, webUrl: data.webUrl },
    };
  },

  async triggerSync(orgId: string, connectorId: string) {
    const connector = await this.getConnector(orgId, connectorId);

    const client = await getTemporalClient();
    await client.workflow.start("connectorSyncWorkflow", {
      taskQueue: TASK_QUEUES.INGESTION,
      workflowId: `connector-sync-${connectorId}`,
      args: [{
        connectorId,
        orgId,
        collectionId: connector.knowledgeCollectionId,
      }],
    });

    return { started: true, workflowId: `connector-sync-${connectorId}` };
  },

  /** Find connectors that are due for sync (used by dispatch workflow) */
  async findConnectorsDueForSync() {
    const now = new Date();

    const rows = await db
      .select()
      .from(knowledgeConnectors)
      .where(
        and(
          eq(knowledgeConnectors.syncEnabled, true),
          isNull(knowledgeConnectors.deletedAt),
          sql`(${knowledgeConnectors.lastSyncAt} IS NULL OR ${knowledgeConnectors.lastSyncAt} + (${knowledgeConnectors.syncIntervalMinutes} || ' minutes')::interval < ${now})`,
        ),
      );

    return rows;
  },
};
