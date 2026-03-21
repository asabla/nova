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

// ── Batch operations ───────────────────────────────────────────────

interface QdrantPoint {
  id: string;
  vector?: number[];
  payload: Record<string, unknown>;
}

export async function upsertPoints(collection: string, points: QdrantPoint[]): Promise<void> {
  const qdrant = getQdrantClient();
  const batchSize = 100;

  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await qdrant.upsert(collection, {
      wait: true,
      points: batch.map((p) => ({
        id: p.id,
        vector: p.vector ?? [0],
        payload: p.payload,
      })),
    });
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

/**
 * Scroll points with only a filter (no text match). Useful for date-range browsing.
 */
export async function scrollFiltered(
  collection: string,
  opts: {
    filter: Record<string, unknown>;
    limit?: number;
  },
): Promise<Array<{ id: string; payload: Record<string, unknown> }>> {
  const qdrant = getQdrantClient();

  const results = await qdrant.scroll(collection, {
    filter: opts.filter as any,
    limit: opts.limit ?? 20,
    with_payload: true,
  });

  return (results.points ?? []).map((p) => ({
    id: typeof p.id === "string" ? p.id : String(p.id),
    payload: (p.payload ?? {}) as Record<string, unknown>,
  }));
}
