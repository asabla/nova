/**
 * Fire-and-forget Qdrant sync functions.
 * Each function upserts or deletes points in Qdrant after a DB write.
 * Errors are logged but never block the API response.
 */
import { COLLECTIONS, upsertPoints, deletePoints, deletePointsByFilter } from "./qdrant";

function fireAndForget(fn: () => Promise<void>): void {
  fn().catch((err) => console.error("[qdrant-sync]", err));
}

function isoOrNull(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

// ── Conversations ──────────────────────────────────────────────────

export function syncConversationUpsert(conv: {
  id: string;
  orgId: string;
  ownerId: string;
  title?: string | null;
  modelId?: string | null;
  visibility?: string | null;
  systemPrompt?: string | null;
  isPinned?: boolean | null;
  isArchived?: boolean | null;
  totalTokens?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): void {
  fireAndForget(async () => {
    await upsertPoints(COLLECTIONS.CONVERSATIONS, [{
      id: conv.id,
      payload: {
        orgId: conv.orgId,
        userId: conv.ownerId,
        title: conv.title ?? "",
        modelId: conv.modelId ?? "",
        visibility: conv.visibility ?? "private",
        hasSystemPrompt: !!conv.systemPrompt,
        isPinned: conv.isPinned ?? false,
        isArchived: conv.isArchived ?? false,
        totalTokens: conv.totalTokens ?? 0,
        createdAt: isoOrNull(conv.createdAt),
        updatedAt: isoOrNull(conv.updatedAt),
      },
    }]);
  });
}

export function syncConversationDelete(id: string): void {
  fireAndForget(() => deletePoints(COLLECTIONS.CONVERSATIONS, [id]));
}

// ── Messages ───────────────────────────────────────────────────────

export function syncMessageUpsert(msg: {
  id: string;
  orgId: string;
  conversationId: string;
  senderType: string;
  senderUserId?: string | null;
  agentId?: string | null;
  modelId?: string | null;
  contentType?: string | null;
  content?: string | null;
  tokenCountPrompt?: number | null;
  tokenCountCompletion?: number | null;
  createdAt?: Date | string | null;
}): void {
  fireAndForget(async () => {
    await upsertPoints(COLLECTIONS.MESSAGES, [{
      id: msg.id,
      payload: {
        orgId: msg.orgId,
        conversationId: msg.conversationId,
        senderType: msg.senderType,
        senderUserId: msg.senderUserId ?? null,
        agentId: msg.agentId ?? null,
        modelId: msg.modelId ?? null,
        contentType: msg.contentType ?? "text",
        content: (msg.content ?? "").slice(0, 10_000),
        tokenCountPrompt: msg.tokenCountPrompt ?? 0,
        tokenCountCompletion: msg.tokenCountCompletion ?? 0,
        createdAt: isoOrNull(msg.createdAt),
      },
    }]);
  });
}

export function syncMessageDelete(id: string): void {
  fireAndForget(() => deletePoints(COLLECTIONS.MESSAGES, [id]));
}

// ── Agents ─────────────────────────────────────────────────────────

export function syncAgentUpsert(agent: {
  id: string;
  orgId: string;
  ownerId?: string | null;
  name: string;
  description?: string | null;
  modelId?: string | null;
  visibility?: string | null;
  isPublished?: boolean | null;
  isEnabled?: boolean | null;
  memoryScope?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): void {
  fireAndForget(async () => {
    await upsertPoints(COLLECTIONS.AGENTS, [{
      id: agent.id,
      payload: {
        orgId: agent.orgId,
        ownerId: agent.ownerId ?? null,
        name: agent.name,
        description: agent.description ?? "",
        modelId: agent.modelId ?? null,
        visibility: agent.visibility ?? "private",
        isPublished: agent.isPublished ?? false,
        isEnabled: agent.isEnabled ?? true,
        memoryScope: agent.memoryScope ?? null,
        createdAt: isoOrNull(agent.createdAt),
        updatedAt: isoOrNull(agent.updatedAt),
      },
    }]);
  });
}

export function syncAgentDelete(id: string): void {
  fireAndForget(() => deletePoints(COLLECTIONS.AGENTS, [id]));
}

// ── Knowledge Documents ────────────────────────────────────────────

export function syncKnowledgeDocUpsert(doc: {
  id: string;
  orgId: string;
  knowledgeCollectionId: string;
  title?: string | null;
  summary?: string | null;
  status?: string | null;
  fileId?: string | null;
  sourceUrl?: string | null;
  tokenCount?: number | null;
  chunkCount?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): void {
  fireAndForget(async () => {
    await upsertPoints(COLLECTIONS.KNOWLEDGE_DOCS, [{
      id: doc.id,
      payload: {
        orgId: doc.orgId,
        collectionId: doc.knowledgeCollectionId,
        title: doc.title ?? "",
        summary: doc.summary ?? "",
        status: doc.status ?? "pending",
        fileId: doc.fileId ?? null,
        sourceUrl: doc.sourceUrl ?? null,
        tokenCount: doc.tokenCount ?? 0,
        chunkCount: doc.chunkCount ?? 0,
        createdAt: isoOrNull(doc.createdAt),
        updatedAt: isoOrNull(doc.updatedAt),
      },
    }]);
  });
}

export function syncKnowledgeDocDelete(id: string): void {
  fireAndForget(() => deletePoints(COLLECTIONS.KNOWLEDGE_DOCS, [id]));
}

export function syncKnowledgeChunksByDocumentDelete(documentId: string): void {
  fireAndForget(() =>
    deletePointsByFilter(COLLECTIONS.KNOWLEDGE_CHUNKS, {
      must: [{ key: "documentId", match: { value: documentId } }],
    }),
  );
}

export function syncKnowledgeChunksByCollectionDelete(collectionId: string): void {
  fireAndForget(() =>
    deletePointsByFilter(COLLECTIONS.KNOWLEDGE_CHUNKS, {
      must: [{ key: "collectionId", match: { value: collectionId } }],
    }),
  );
}

// ── Files ──────────────────────────────────────────────────────────

export function syncFileUpsert(file: {
  id: string;
  orgId: string;
  userId: string;
  filename: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  storagePath?: string | null;
  storageBucket?: string | null;
  createdAt?: Date | string | null;
}): void {
  fireAndForget(async () => {
    await upsertPoints(COLLECTIONS.FILES, [{
      id: file.id,
      payload: {
        orgId: file.orgId,
        userId: file.userId,
        filename: file.filename,
        contentType: file.contentType ?? null,
        sizeBytes: file.sizeBytes ?? 0,
        storagePath: file.storagePath ?? null,
        storageBucket: file.storageBucket ?? null,
        createdAt: isoOrNull(file.createdAt),
      },
    }]);
  });
}

export function syncFileDelete(id: string): void {
  fireAndForget(async () => {
    await deletePoints(COLLECTIONS.FILES, [id]);
    await deletePointsByFilter(COLLECTIONS.FILE_CHUNKS, {
      must: [{ key: "fileId", match: { value: id } }],
    });
  });
}
