/**
 * Qdrant backfill script — migrates existing data from PostgreSQL to Qdrant.
 *
 * Run: bun scripts/qdrant-backfill.ts
 *
 * Idempotent (upserts). Safe to re-run.
 */
import { QdrantClient } from "@qdrant/js-client-rest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

// ── Config ─────────────────────────────────────────────────────────
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://nova:nova@localhost:5432/nova";
const LITELLM_URL = process.env.LITELLM_API_URL ?? process.env.LITELLM_URL ?? "http://localhost:4000";
const LITELLM_KEY = process.env.LITELLM_MASTER_KEY ?? process.env.LITELLM_API_KEY ?? "sk-nova-litellm-dev";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
const BATCH_SIZE = 100;
const EMBED_BATCH_SIZE = 20;

const qdrant = new QdrantClient({ url: QDRANT_URL });
const client = postgres(DATABASE_URL);
const db = drizzle(client);
const openai = new OpenAI({ baseURL: LITELLM_URL, apiKey: LITELLM_KEY });

const COLLECTIONS = {
  CONVERSATIONS: "nova_conversations",
  MESSAGES: "nova_messages",
  AGENTS: "nova_agents",
  KNOWLEDGE_DOCS: "nova_knowledge_docs",
  KNOWLEDGE_CHUNKS: "nova_knowledge_chunks",
  AGENT_MEMORIES: "nova_agent_memories",
  FILES: "nova_files",
  FILE_CHUNKS: "nova_file_chunks",
};

// ── Helpers ────────────────────────────────────────────────────────

async function ensureCollection(name: string, vectorSize?: number, fullTextFields?: string[], keywordFields?: string[]) {
  try {
    await qdrant.getCollection(name);
    console.log(`  [ok] ${name} exists`);
    return;
  } catch {
    // Create
  }

  await qdrant.createCollection(name, {
    vectors: { size: vectorSize ?? 1, distance: "Cosine" },
  });

  for (const field of fullTextFields ?? []) {
    await qdrant.createPayloadIndex(name, {
      field_name: field,
      field_schema: { type: "text", tokenizer: "word", min_token_len: 2, max_token_len: 20, lowercase: true },
    });
  }
  for (const field of keywordFields ?? []) {
    await qdrant.createPayloadIndex(name, { field_name: field, field_schema: "keyword" });
  }

  console.log(`  [created] ${name}`);
}

async function upsertBatch(collection: string, points: any[]) {
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await qdrant.upsert(collection, { wait: true, points: batch });
  }
}

async function batchEmbed(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE).map((t) => t.slice(0, 8000));
    try {
      const resp = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
      for (const item of resp.data) {
        const isZero = item.embedding.every((v) => v === 0);
        results.push(isZero ? null : item.embedding);
      }
    } catch (err) {
      console.warn(`  [warn] Embedding batch failed:`, err);
      results.push(...batch.map(() => null));
    }
  }
  return results;
}

function isoOrNull(d: unknown): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") return d;
  return null;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("=== Qdrant Backfill ===\n");

  // 1. Ensure collections
  console.log("1. Ensuring collections...");
  await ensureCollection(COLLECTIONS.CONVERSATIONS, undefined, ["title"], ["orgId", "userId", "modelId"]);
  await ensureCollection(COLLECTIONS.MESSAGES, 1536, ["content"], ["orgId", "conversationId", "senderType"]);
  await ensureCollection(COLLECTIONS.AGENTS, undefined, ["name", "description"], ["orgId"]);
  await ensureCollection(COLLECTIONS.KNOWLEDGE_DOCS, undefined, ["title", "summary"], ["orgId", "collectionId", "tags"]);
  await ensureCollection(COLLECTIONS.KNOWLEDGE_CHUNKS, 1536, ["content"], ["orgId", "collectionId", "documentId"]);
  await ensureCollection(COLLECTIONS.AGENT_MEMORIES, 1536, ["content"], ["orgId", "agentId", "userId", "scope"]);
  await ensureCollection(COLLECTIONS.FILES, undefined, ["filename"], ["orgId", "userId"]);
  await ensureCollection(COLLECTIONS.FILE_CHUNKS, 1536, ["content"], ["orgId", "fileId"]);

  // 2. Backfill conversations
  console.log("\n2. Backfilling conversations...");
  const convRows = await db.execute(sql`
    SELECT id, org_id, owner_id, title, model_id, visibility, system_prompt,
           is_pinned, is_archived, total_tokens, created_at, updated_at
    FROM conversations WHERE deleted_at IS NULL
  `);
  const convPoints = (convRows as any[]).map((r: any) => ({
    id: r.id,
    vector: [0],
    payload: {
      orgId: r.org_id,
      userId: r.owner_id,
      title: r.title ?? "",
      modelId: r.model_id ?? "",
      visibility: r.visibility ?? "private",
      hasSystemPrompt: !!r.system_prompt,
      isPinned: r.is_pinned ?? false,
      isArchived: r.is_archived ?? false,
      totalTokens: r.total_tokens ?? 0,
      createdAt: isoOrNull(r.created_at),
      updatedAt: isoOrNull(r.updated_at),
    },
  }));
  await upsertBatch(COLLECTIONS.CONVERSATIONS, convPoints);
  console.log(`  Indexed ${convPoints.length} conversations`);

  // 3. Backfill agents
  console.log("\n3. Backfilling agents...");
  const agentRows = await db.execute(sql`
    SELECT id, org_id, owner_id, name, description, model_id, visibility,
           is_published, is_enabled, memory_scope, created_at, updated_at
    FROM agents WHERE deleted_at IS NULL
  `);
  const agentPoints = (agentRows as any[]).map((r: any) => ({
    id: r.id,
    vector: [0],
    payload: {
      orgId: r.org_id,
      ownerId: r.owner_id ?? null,
      name: r.name,
      description: r.description ?? "",
      modelId: r.model_id ?? null,
      visibility: r.visibility ?? "private",
      isPublished: r.is_published ?? false,
      isEnabled: r.is_enabled ?? true,
      memoryScope: r.memory_scope ?? null,
      createdAt: isoOrNull(r.created_at),
      updatedAt: isoOrNull(r.updated_at),
    },
  }));
  await upsertBatch(COLLECTIONS.AGENTS, agentPoints);
  console.log(`  Indexed ${agentPoints.length} agents`);

  // 4. Backfill knowledge documents
  console.log("\n4. Backfilling knowledge documents...");
  const docRows = await db.execute(sql`
    SELECT id, org_id, knowledge_collection_id, title, summary, status,
           file_id, source_url, token_count, chunk_count, created_at, updated_at
    FROM knowledge_documents WHERE deleted_at IS NULL
  `);
  const docPoints = (docRows as any[]).map((r: any) => ({
    id: r.id,
    vector: [0],
    payload: {
      orgId: r.org_id,
      collectionId: r.knowledge_collection_id,
      title: r.title ?? "",
      summary: r.summary ?? "",
      status: r.status ?? "pending",
      fileId: r.file_id ?? null,
      sourceUrl: r.source_url ?? null,
      tokenCount: r.token_count ?? 0,
      chunkCount: r.chunk_count ?? 0,
      createdAt: isoOrNull(r.created_at),
      updatedAt: isoOrNull(r.updated_at),
    },
  }));
  await upsertBatch(COLLECTIONS.KNOWLEDGE_DOCS, docPoints);
  console.log(`  Indexed ${docPoints.length} knowledge documents`);

  // 5. Backfill files
  console.log("\n5. Backfilling files...");
  const fileRows = await db.execute(sql`
    SELECT id, org_id, user_id, filename, content_type, size_bytes,
           storage_path, storage_bucket, created_at
    FROM files WHERE deleted_at IS NULL
  `);
  const filePoints = (fileRows as any[]).map((r: any) => ({
    id: r.id,
    vector: [0],
    payload: {
      orgId: r.org_id,
      userId: r.user_id,
      filename: r.filename,
      contentType: r.content_type ?? null,
      sizeBytes: r.size_bytes ?? 0,
      storagePath: r.storage_path ?? null,
      storageBucket: r.storage_bucket ?? null,
      createdAt: isoOrNull(r.created_at),
    },
  }));
  await upsertBatch(COLLECTIONS.FILES, filePoints);
  console.log(`  Indexed ${filePoints.length} files`);

  // 6. Backfill knowledge chunks (metadata only — vectors will be regenerated on reindex)
  console.log("\n6. Backfilling knowledge chunks (metadata only)...");
  let chunkOffset = 0;
  let totalChunks = 0;
  while (true) {
    const chunkRows = await db.execute(sql`
      SELECT kc.id, kc.org_id, kc.knowledge_collection_id, kc.knowledge_document_id,
             kc.chunk_index, kc.content, kc.token_count, kc.metadata,
             kd.title AS doc_title, kd.source_url
      FROM knowledge_chunks kc
      LEFT JOIN knowledge_documents kd ON kd.id = kc.knowledge_document_id
      WHERE kc.deleted_at IS NULL
      ORDER BY kc.id
      LIMIT ${BATCH_SIZE} OFFSET ${chunkOffset}
    `);
    const rows = chunkRows as any[];
    if (rows.length === 0) break;

    // Generate embeddings for chunks
    const texts = rows.map((r: any) => (r.content as string).slice(0, 8000));
    const embeddings = await batchEmbed(texts);

    const points = rows
      .map((r: any, i: number) => {
        if (!embeddings[i]) return null;
        return {
          id: r.id,
          vector: embeddings[i],
          payload: {
            orgId: r.org_id,
            collectionId: r.knowledge_collection_id,
            documentId: r.knowledge_document_id,
            chunkIndex: r.chunk_index,
            content: (r.content as string).slice(0, 10_000),
            tokenCount: r.token_count ?? Math.ceil((r.content as string).length / 4),
            documentTitle: r.doc_title ?? null,
            sourceUrl: r.source_url ?? null,
            sectionHeading: (r.metadata as any)?.sectionHeading ?? null,
            createdAt: isoOrNull(r.created_at),
          },
        };
      })
      .filter(Boolean) as any[];

    if (points.length > 0) {
      await upsertBatch(COLLECTIONS.KNOWLEDGE_CHUNKS, points);
    }
    totalChunks += rows.length;
    chunkOffset += BATCH_SIZE;
    process.stdout.write(`  ${totalChunks} chunks...\r`);
  }
  console.log(`  Indexed ${totalChunks} knowledge chunks`);

  // 7. Backfill agent memories (re-embed from content)
  console.log("\n7. Backfilling agent memories...");
  let memOffset = 0;
  let totalMems = 0;
  while (true) {
    const memRows = await db.execute(sql`
      SELECT id, org_id, agent_id, user_id, scope, content,
             source_type, source_id, metadata, created_at
      FROM agent_memory_vectors
      WHERE deleted_at IS NULL
      ORDER BY id
      LIMIT ${BATCH_SIZE} OFFSET ${memOffset}
    `);
    const rows = memRows as any[];
    if (rows.length === 0) break;

    const texts = rows.map((r: any) => (r.content as string).slice(0, 8000));
    const embeddings = await batchEmbed(texts);

    const points = rows
      .map((r: any, i: number) => {
        if (!embeddings[i]) return null;
        return {
          id: r.id,
          vector: embeddings[i],
          payload: {
            orgId: r.org_id,
            agentId: r.agent_id,
            userId: r.user_id ?? null,
            scope: r.scope,
            content: r.content,
            sourceType: r.source_type ?? null,
            sourceId: r.source_id ?? null,
            metadata: r.metadata ?? null,
            createdAt: isoOrNull(r.created_at),
          },
        };
      })
      .filter(Boolean) as any[];

    if (points.length > 0) {
      await upsertBatch(COLLECTIONS.AGENT_MEMORIES, points);
    }
    totalMems += rows.length;
    memOffset += BATCH_SIZE;
  }
  console.log(`  Indexed ${totalMems} agent memories`);

  // 8. Backfill messages (need to generate embeddings — slowest step)
  console.log("\n8. Backfilling messages (generating embeddings)...");
  let msgOffset = 0;
  let totalMsgs = 0;
  while (true) {
    const msgRows = await db.execute(sql`
      SELECT id, org_id, conversation_id, sender_type, sender_user_id,
             agent_id, model_id, content_type, content,
             token_count_prompt, token_count_completion, created_at
      FROM messages
      WHERE deleted_at IS NULL AND content IS NOT NULL AND content != ''
        AND sender_type IN ('user', 'assistant')
      ORDER BY created_at
      LIMIT ${EMBED_BATCH_SIZE} OFFSET ${msgOffset}
    `);
    if ((msgRows as any[]).length === 0) break;

    const rows = msgRows as any[];
    const texts = rows.map((r: any) => (r.content as string).slice(0, 8000));
    const embeddings = await batchEmbed(texts);

    const points = rows
      .map((r: any, i: number) => {
        if (!embeddings[i]) return null;
        return {
          id: r.id,
          vector: embeddings[i],
          payload: {
            orgId: r.org_id,
            conversationId: r.conversation_id,
            senderType: r.sender_type,
            senderUserId: r.sender_user_id ?? null,
            agentId: r.agent_id ?? null,
            modelId: r.model_id ?? null,
            contentType: r.content_type ?? "text",
            content: (r.content as string).slice(0, 10_000),
            tokenCountPrompt: r.token_count_prompt ?? 0,
            tokenCountCompletion: r.token_count_completion ?? 0,
            embeddingModel: EMBEDDING_MODEL,
            createdAt: isoOrNull(r.created_at),
          },
        };
      })
      .filter(Boolean) as any[];

    if (points.length > 0) {
      await upsertBatch(COLLECTIONS.MESSAGES, points);
    }

    totalMsgs += rows.length;
    msgOffset += EMBED_BATCH_SIZE;
    process.stdout.write(`  ${totalMsgs} messages...\r`);
  }
  console.log(`  Indexed ${totalMsgs} messages`);

  console.log("\n=== Backfill complete ===");
  await client.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
