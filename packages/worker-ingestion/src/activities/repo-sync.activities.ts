import { eq, and, isNull } from "drizzle-orm";
import { Context } from "@temporalio/activity";
import { db } from "@nova/worker-shared/db";
import { openai } from "@nova/worker-shared/litellm";
import { getDefaultEmbeddingModel } from "@nova/worker-shared/models";
import { upsertPoints, deletePointsByFilter, COLLECTIONS } from "@nova/worker-shared/qdrant";
import { knowledgeDocuments, knowledgeChunks, knowledgeConnectors } from "@nova/shared/schemas";
import type { ContentChunk } from "@nova/shared/content";
import type { ConnectorSyncInput } from "../workflows/connector-sync.js";
import {
  createRepoProvider,
  filterTree,
  fetchFileContents,
  cloneRepo,
  getCloneHeadSha,
  walkClonedRepo,
  cleanupClone,
  type RepoFile,
  type RepoProvider,
} from "../lib/git-utils.js";
import { chunkCodeFile } from "../lib/code-chunker.js";
import { logger } from "@nova/worker-shared/logger";

interface EmbeddedChunk extends ContentChunk {
  embedding: number[] | null;
}

/**
 * Main activity: sync a git repository into the knowledge base.
 *
 * Uses provider REST APIs (GitHub, GitLab) when possible to avoid disk I/O.
 * Falls back to shallow git clone for generic git URLs.
 */
export async function syncRepoFiles(
  input: ConnectorSyncInput,
): Promise<{ deltaCursor: string | null; syncedDocumentCount: number }> {
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

  const metadata = (connector.metadata ?? {}) as Record<string, unknown>;
  const repoUrl = metadata.repoUrl as string;
  const branch = (metadata.branch as string) ?? "main";
  const lastCommitSha = metadata.lastCommitSha as string | undefined;
  const includeGlobs = (metadata.includeGlobs as string[]) ?? [];
  const excludeGlobs = (metadata.excludeGlobs as string[]) ?? [];

  if (!repoUrl) throw new Error("Connector metadata missing repoUrl");

  // Decrypt auth token
  const token = connector.clientSecretEncrypted
    ? Buffer.from(connector.clientSecretEncrypted, "base64").toString("utf-8")
    : undefined;

  // Try provider API first (no disk I/O), fall back to clone
  const provider = createRepoProvider(repoUrl, token);

  if (provider) {
    return syncViaApi(provider, branch, lastCommitSha, includeGlobs, excludeGlobs, input, connector);
  } else {
    return syncViaClone(repoUrl, branch, token, lastCommitSha, includeGlobs, excludeGlobs, input, connector);
  }
}

/**
 * Sync via provider REST API (GitHub, GitLab) — zero disk I/O.
 */
async function syncViaApi(
  provider: RepoProvider,
  branch: string,
  lastCommitSha: string | undefined,
  includeGlobs: string[],
  excludeGlobs: string[],
  input: ConnectorSyncInput,
  connector: typeof knowledgeConnectors.$inferSelect,
): Promise<{ deltaCursor: string | null; syncedDocumentCount: number }> {
  Context.current().heartbeat("Fetching repository tree via API...");

  const headSha = await provider.getHeadSha(branch);

  // Skip if nothing changed
  if (lastCommitSha === headSha) {
    return {
      deltaCursor: headSha,
      syncedDocumentCount: connector.syncedDocumentCount ?? 0,
    };
  }

  let filesToProcess: RepoFile[];
  let deletedPaths: string[] = [];
  let syncedCount = connector.syncedDocumentCount ?? 0;

  if (lastCommitSha) {
    Context.current().heartbeat("Computing changes since last sync...");
    const changes = await provider.getChangedFiles(lastCommitSha, headSha);

    if (changes.length > 0) {
      // Incremental sync
      deletedPaths = changes.filter((c) => c.status === "deleted").map((c) => c.path);
      for (const c of changes.filter((c) => c.status === "renamed")) {
        if (c.oldPath) deletedPaths.push(c.oldPath);
      }

      const changedPaths = new Set(
        changes.filter((c) => c.status !== "deleted").map((c) => c.path),
      );

      // Only fetch the tree entries for changed files
      const tree = await provider.getTree(branch);
      const filteredTree = filterTree(tree, { includeGlobs, excludeGlobs });
      const changedEntries = filteredTree.filter((e) => changedPaths.has(e.path));

      Context.current().heartbeat(`Fetching ${changedEntries.length} changed files...`);
      filesToProcess = await fetchFileContents(provider, changedEntries, branch, (fetched, total) => {
        Context.current().heartbeat(`Fetching files: ${fetched}/${total}`);
      });
    } else {
      // No changes detected or comparison failed — full sync
      syncedCount = 0;
      const tree = await provider.getTree(branch);
      const filteredTree = filterTree(tree, { includeGlobs, excludeGlobs });

      Context.current().heartbeat(`Fetching ${filteredTree.length} files...`);
      filesToProcess = await fetchFileContents(provider, filteredTree, branch, (fetched, total) => {
        Context.current().heartbeat(`Fetching files: ${fetched}/${total}`);
      });
    }
  } else {
    // First sync — fetch all files
    const tree = await provider.getTree(branch);
    const filteredTree = filterTree(tree, { includeGlobs, excludeGlobs });

    Context.current().heartbeat(`Fetching ${filteredTree.length} files...`);
    filesToProcess = await fetchFileContents(provider, filteredTree, branch, (fetched, total) => {
      Context.current().heartbeat(`Fetching files: ${fetched}/${total}`);
    });
  }

  return processFiles(filesToProcess, deletedPaths, syncedCount, headSha, input);
}

/**
 * Sync via git clone — fallback for generic git URLs.
 */
async function syncViaClone(
  repoUrl: string,
  branch: string,
  token: string | undefined,
  lastCommitSha: string | undefined,
  includeGlobs: string[],
  excludeGlobs: string[],
  input: ConnectorSyncInput,
  connector: typeof knowledgeConnectors.$inferSelect,
): Promise<{ deltaCursor: string | null; syncedDocumentCount: number }> {
  Context.current().heartbeat("Cloning repository...");
  const repoPath = await cloneRepo(repoUrl, { branch, token, depth: 1 });

  try {
    const headSha = await getCloneHeadSha(repoPath);

    if (lastCommitSha === headSha) {
      return {
        deltaCursor: headSha,
        syncedDocumentCount: connector.syncedDocumentCount ?? 0,
      };
    }

    Context.current().heartbeat("Walking repository files...");
    const filesToProcess = await walkClonedRepo(repoPath, { includeGlobs, excludeGlobs });

    // Clone path doesn't support incremental diff easily (shallow clone),
    // so always do a full sync
    return processFiles(filesToProcess, [], 0, headSha, input);
  } finally {
    await cleanupClone(repoPath);
  }
}

/**
 * Process files: chunk → embed → persist. Shared by API and clone paths.
 */
async function processFiles(
  filesToProcess: RepoFile[],
  deletedPaths: string[],
  initialCount: number,
  headSha: string,
  input: ConnectorSyncInput,
): Promise<{ deltaCursor: string | null; syncedDocumentCount: number }> {
  // Handle deletions
  for (const deletedPath of deletedPaths) {
    await removeDocumentByPath(input.connectorId, deletedPath, input.orgId);
  }

  const embeddingModel = process.env.EMBEDDING_MODEL ?? await getDefaultEmbeddingModel();
  let syncedCount = initialCount;
  const BATCH_SIZE = 50;

  for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
    const batch = filesToProcess.slice(i, i + BATCH_SIZE);
    Context.current().heartbeat(
      `Processing files ${i + 1}-${Math.min(i + BATCH_SIZE, filesToProcess.length)} of ${filesToProcess.length}`,
    );

    for (const file of batch) {
      try {
        await processRepoFile(file, input, embeddingModel);
        syncedCount++;
      } catch (err: unknown) {
        logger.warn({ err, filePath: file.relativePath }, "[repo-sync] Failed to process file");
      }
    }
  }

  return { deltaCursor: headSha, syncedDocumentCount: syncedCount };
}

/**
 * Process a single repository file: chunk → embed → persist.
 */
async function processRepoFile(
  file: RepoFile,
  input: ConnectorSyncInput,
  embeddingModel: string,
): Promise<void> {
  const documentId = await upsertRepoDocument({
    orgId: input.orgId,
    collectionId: input.collectionId,
    connectorId: input.connectorId,
    externalId: file.relativePath,
    title: file.relativePath,
    content: file.content,
    metadata: {
      provider: "git",
      filePath: file.relativePath,
      sizeBytes: file.sizeBytes,
      sha: file.sha,
    },
  });

  const chunks = await chunkCodeFile(file.content, file.relativePath, {
    filePath: file.relativePath,
    maxChunkSize: 2000,
    minChunkSize: 50,
  });

  if (chunks.length === 0) return;

  const embedded = await embedChunks(chunks, embeddingModel);

  await persistRepoChunks(documentId, input.collectionId, input.orgId, embedded, file.relativePath);

  const totalTokens = chunks.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0);
  await db
    .update(knowledgeDocuments)
    .set({
      chunkCount: chunks.length,
      tokenCount: totalTokens,
      status: "ready",
      updatedAt: new Date(),
    })
    .where(eq(knowledgeDocuments.id, documentId));
}

async function embedChunks(
  chunks: ContentChunk[],
  embeddingModel: string,
): Promise<EmbeddedChunk[]> {
  const batchSize = 20;
  const results: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => {
      const prefix = c.metadata.symbolName
        ? `[${c.metadata.symbolKind}: ${c.metadata.symbolName}] `
        : c.metadata.filePath
          ? `[${c.metadata.filePath}] `
          : "";
      return prefix + c.text;
    });

    try {
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: texts,
      });

      for (const item of response.data) {
        const isZero = item.embedding.every((v: number) => v === 0);
        results.push({ ...batch[item.index], embedding: isZero ? null : item.embedding });
      }
    } catch (err: unknown) {
      logger.warn({ err }, "[repo-sync] Embedding API error, skipping batch");
      results.push(...batch.map((c) => ({ ...c, embedding: null })));
    }
  }

  return results;
}

async function persistRepoChunks(
  documentId: string,
  collectionId: string,
  orgId: string,
  chunks: EmbeddedChunk[],
  filePath: string,
): Promise<void> {
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.knowledgeDocumentId, documentId));
  await deletePointsByFilter(COLLECTIONS.KNOWLEDGE_CHUNKS, {
    must: [{ key: "documentId", match: { value: documentId } }],
  }).catch((err: unknown) => logger.warn({ err }, "[qdrant] Failed to delete old chunks"));

  const qdrantPoints: Array<{
    id: string;
    vector?: number[];
    payload: Record<string, unknown>;
  }> = [];

  for (const chunk of chunks) {
    const [row] = await db.insert(knowledgeChunks).values({
      knowledgeDocumentId: documentId,
      knowledgeCollectionId: collectionId,
      orgId,
      content: chunk.text,
      chunkIndex: chunk.index,
      tokenCount: Math.ceil(chunk.text.length / 4),
      metadata: {
        ...chunk.metadata,
        documentTitle: filePath,
      },
    }).returning({ id: knowledgeChunks.id });

    if (chunk.embedding && row) {
      qdrantPoints.push({
        id: row.id,
        vector: chunk.embedding,
        payload: {
          orgId,
          collectionId,
          documentId,
          chunkIndex: chunk.index,
          content: chunk.text.slice(0, 10_000),
          tokenCount: Math.ceil(chunk.text.length / 4),
          documentTitle: filePath,
          sectionHeading: chunk.metadata.symbolName ?? null,
          language: chunk.metadata.language ?? null,
          symbolName: chunk.metadata.symbolName ?? null,
          symbolKind: chunk.metadata.symbolKind ?? null,
          filePath: chunk.metadata.filePath ?? null,
          isExported: chunk.metadata.isExported ?? null,
          createdAt: new Date().toISOString(),
        },
      });
    }
  }

  if (qdrantPoints.length > 0) {
    await upsertPoints(COLLECTIONS.KNOWLEDGE_CHUNKS, qdrantPoints).catch((err: unknown) =>
      logger.warn({ err }, "[qdrant] Failed to upsert repo chunks"),
    );
  }
}

async function upsertRepoDocument(data: {
  orgId: string;
  collectionId: string;
  connectorId: string;
  externalId: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}): Promise<string> {
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
    await db
      .update(knowledgeDocuments)
      .set({
        title: data.title,
        content: data.content,
        metadata: data.metadata,
        status: "processing",
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, existing.id));
    return existing.id;
  }

  const [row] = await db.insert(knowledgeDocuments).values({
    knowledgeCollectionId: data.collectionId,
    orgId: data.orgId,
    connectorId: data.connectorId,
    externalId: data.externalId,
    title: data.title,
    content: data.content,
    metadata: data.metadata,
    status: "processing",
  }).returning({ id: knowledgeDocuments.id });

  return row.id;
}

async function removeDocumentByPath(
  connectorId: string,
  filePath: string,
  orgId: string,
): Promise<void> {
  const [doc] = await db
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.connectorId, connectorId),
        eq(knowledgeDocuments.externalId, filePath),
        isNull(knowledgeDocuments.deletedAt),
      ),
    );

  if (!doc) return;

  await db
    .update(knowledgeDocuments)
    .set({ deletedAt: new Date() })
    .where(eq(knowledgeDocuments.id, doc.id));

  try {
    await deletePointsByFilter(COLLECTIONS.KNOWLEDGE_CHUNKS, {
      must: [
        { key: "orgId", match: { value: orgId } },
        { key: "documentId", match: { value: doc.id } },
      ],
    });
  } catch (err: unknown) {
    logger.warn({ err, filePath }, "[repo-sync] Failed to delete vectors");
  }
}
