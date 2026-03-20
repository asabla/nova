import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "./env";

// ── Collection names ───────────────────────────────────────────────
export const COLLECTIONS = {
  CONVERSATIONS: "nova_conversations",
  MESSAGES: "nova_messages",
  AGENTS: "nova_agents",
  KNOWLEDGE_DOCS: "nova_knowledge_docs",
  KNOWLEDGE_CHUNKS: "nova_knowledge_chunks",
  AGENT_MEMORIES: "nova_agent_memories",
  FILES: "nova_files",
  FILE_CHUNKS: "nova_file_chunks",
} as const;

/** Collections that have real vectors (not text-only dummy vectors) */
const VECTOR_COLLECTIONS = new Set([
  COLLECTIONS.MESSAGES,
  COLLECTIONS.KNOWLEDGE_CHUNKS,
  COLLECTIONS.AGENT_MEMORIES,
  COLLECTIONS.FILE_CHUNKS,
]);

// ── Singleton client ───────────────────────────────────────────────
let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
    });
  }
  return client;
}

// ── Collection setup ───────────────────────────────────────────────

interface CollectionConfig {
  vectorSize?: number;
  distance?: "Cosine" | "Euclid" | "Dot";
  fullTextFields?: string[];
  keywordFields?: string[];
}

async function ensureCollection(name: string, config: CollectionConfig): Promise<void> {
  const qdrant = getQdrantClient();

  try {
    await qdrant.getCollection(name);
    return; // Already exists
  } catch {
    // Collection doesn't exist, create it
  }

  if (config.vectorSize) {
    await qdrant.createCollection(name, {
      vectors: {
        size: config.vectorSize,
        distance: config.distance ?? "Cosine",
      },
    });
  } else {
    // Text-only collection — use a dummy 1-dim vector (Qdrant requires vectors config)
    await qdrant.createCollection(name, {
      vectors: {
        size: 1,
        distance: "Cosine",
      },
    });
  }

  // Create full-text indexes
  for (const field of config.fullTextFields ?? []) {
    await qdrant.createPayloadIndex(name, {
      field_name: field,
      field_schema: {
        type: "text",
        tokenizer: "word",
        min_token_len: 2,
        max_token_len: 20,
        lowercase: true,
      },
    });
  }

  // Create keyword indexes
  for (const field of config.keywordFields ?? []) {
    await qdrant.createPayloadIndex(name, {
      field_name: field,
      field_schema: "keyword",
    });
  }
}

export async function ensureAllCollections(): Promise<void> {
  const configs: Record<string, CollectionConfig> = {
    [COLLECTIONS.CONVERSATIONS]: {
      fullTextFields: ["title"],
      keywordFields: ["orgId", "userId", "modelId"],
    },
    [COLLECTIONS.MESSAGES]: {
      vectorSize: 1536,
      fullTextFields: ["content"],
      keywordFields: ["orgId", "conversationId", "senderType"],
    },
    [COLLECTIONS.AGENTS]: {
      fullTextFields: ["name", "description"],
      keywordFields: ["orgId"],
    },
    [COLLECTIONS.KNOWLEDGE_DOCS]: {
      fullTextFields: ["title", "summary"],
      keywordFields: ["orgId", "collectionId", "tags"],
    },
    [COLLECTIONS.KNOWLEDGE_CHUNKS]: {
      vectorSize: 1536,
      fullTextFields: ["content"],
      keywordFields: ["orgId", "collectionId", "documentId"],
    },
    [COLLECTIONS.AGENT_MEMORIES]: {
      vectorSize: 1536,
      fullTextFields: ["content"],
      keywordFields: ["orgId", "agentId", "userId", "scope"],
    },
    [COLLECTIONS.FILES]: {
      fullTextFields: ["filename"],
      keywordFields: ["orgId", "userId"],
    },
    [COLLECTIONS.FILE_CHUNKS]: {
      vectorSize: 1536,
      fullTextFields: ["content"],
      keywordFields: ["orgId", "fileId"],
    },
  };

  for (const [name, config] of Object.entries(configs)) {
    try {
      await ensureCollection(name, config);
    } catch (err) {
      console.error(`[qdrant] Failed to ensure collection ${name}:`, err);
    }
  }

  console.log("[qdrant] All collections ensured");
}

// ── Batch operations ───────────────────────────────────────────────

interface QdrantPoint {
  id: string;
  vector?: number[];
  payload: Record<string, unknown>;
}

export async function upsertPoints(collection: string, points: QdrantPoint[]): Promise<void> {
  const qdrant = getQdrantClient();
  const batchSize = 100;
  const isVectorCollection = VECTOR_COLLECTIONS.has(collection as any);

  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);

    if (isVectorCollection) {
      // Split: points with vectors get upserted, payload-only points use setPayload
      const withVector = batch.filter((p) => p.vector && p.vector.length > 1);
      const payloadOnly = batch.filter((p) => !p.vector || p.vector.length <= 1);

      if (withVector.length > 0) {
        await qdrant.upsert(collection, {
          wait: true,
          points: withVector.map((p) => ({
            id: p.id,
            vector: p.vector!,
            payload: p.payload,
          })),
        });
      }

      // For payload-only updates on vector collections, use setPayload
      // (the point must already exist — if not, the embedding workflow will create it)
      for (const p of payloadOnly) {
        await qdrant.setPayload(collection, {
          wait: true,
          payload: p.payload,
          points: [p.id],
        }).catch(() => {
          // Point doesn't exist yet — embedding workflow will create it later
        });
      }
    } else {
      // Text-only collection — use dummy 1-dim vector
      await qdrant.upsert(collection, {
        wait: true,
        points: batch.map((p) => ({
          id: p.id,
          vector: [0],
          payload: p.payload,
        })),
      });
    }
  }
}

export async function deletePoints(collection: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const qdrant = getQdrantClient();
  await qdrant.delete(collection, {
    wait: true,
    points: ids,
  });
}

export async function deletePointsByFilter(
  collection: string,
  filter: Record<string, unknown>,
): Promise<void> {
  const qdrant = getQdrantClient();
  await qdrant.delete(collection, {
    wait: true,
    filter: filter as any,
  });
}

export async function searchVector(
  collection: string,
  vector: number[],
  opts: {
    filter?: Record<string, unknown>;
    limit?: number;
    scoreThreshold?: number;
    withPayload?: boolean;
  } = {},
): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
  const qdrant = getQdrantClient();
  const results = await qdrant.search(collection, {
    vector,
    filter: opts.filter as any,
    limit: opts.limit ?? 10,
    score_threshold: opts.scoreThreshold,
    with_payload: opts.withPayload ?? true,
  });

  return results.map((r) => ({
    id: typeof r.id === "string" ? r.id : String(r.id),
    score: r.score,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));
}

export async function scrollFullText(
  collection: string,
  field: string,
  query: string,
  opts: {
    filter?: Record<string, unknown>;
    limit?: number;
  } = {},
): Promise<Array<{ id: string; payload: Record<string, unknown> }>> {
  const qdrant = getQdrantClient();

  const must: any[] = [
    {
      key: field,
      match: { text: query },
    },
  ];

  // Merge additional filter conditions
  if (opts.filter && (opts.filter as any).must) {
    must.push(...(opts.filter as any).must);
  }

  const results = await qdrant.scroll(collection, {
    filter: { must },
    limit: opts.limit ?? 20,
    with_payload: true,
  });

  return (results.points ?? []).map((p) => ({
    id: typeof p.id === "string" ? p.id : String(p.id),
    payload: (p.payload ?? {}) as Record<string, unknown>,
  }));
}
