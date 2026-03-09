import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { LITELLM_URL, litellmHeaders } from "../lib/litellm";
import { getDefaultEmbeddingModel } from "../lib/models";
import { knowledgeDocuments, knowledgeChunks } from "@nova/shared/schemas";
import { files } from "@nova/shared/schema";
import type { DocumentIngestionInput } from "../workflows/document-ingestion";

async function getMinioClient() {
  const { Client: MinioClient } = await import("minio");
  const endpoint = new URL(process.env.MINIO_ENDPOINT ?? "http://minio:9000");
  return new MinioClient({
    endPoint: endpoint.hostname,
    port: Number(endpoint.port) || 9000,
    useSSL: endpoint.protocol === "https:",
    accessKey: process.env.MINIO_ROOT_USER ?? "minioadmin",
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? "minioadmin",
  });
}

async function resolveDocumentContent(input: DocumentIngestionInput): Promise<string> {
  const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, input.documentId));
  if (!doc) throw new Error(`Document ${input.documentId} not found`);

  if (doc.content) return doc.content;

  if (doc.sourceUrl || input.sourceUrl) {
    const url = doc.sourceUrl ?? input.sourceUrl!;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch URL ${url}: ${resp.status}`);
    return resp.text();
  }

  const fileId = doc.fileId ?? input.fileId;
  if (fileId) {
    const [fileRecord] = await db.select().from(files).where(eq(files.id, fileId));
    if (!fileRecord) throw new Error(`File record ${fileId} not found`);

    const minio = await getMinioClient();
    const bucket = process.env.MINIO_BUCKET ?? "nova-files";
    const stream = await minio.getObject(bucket, fileRecord.storagePath);
    const buffers: Buffer[] = [];
    for await (const chunk of stream) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const fileBuffer = Buffer.concat(buffers);

    const ct = (fileRecord.contentType ?? "").toLowerCase();
    if (ct === "application/pdf" || fileRecord.filename?.toLowerCase().endsWith(".pdf")) {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(fileBuffer));
      const pages = result.text;
      return Array.isArray(pages) ? pages.join("\n") : String(pages);
    }

    return fileBuffer.toString("utf-8");
  }

  return "";
}

function splitIntoChunks(content: string, chunkSize = 1000, overlap = 200): { text: string; index: number }[] {
  const chunks: { text: string; index: number }[] = [];
  let start = 0;
  let index = 0;
  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    chunks.push({ text: content.slice(start, end), index });
    start += chunkSize - overlap;
    index++;
  }
  return chunks;
}

async function embedChunks(
  chunks: { text: string; index: number }[],
): Promise<{ text: string; index: number; embedding: number[] | null }[]> {
  const embeddingModel = process.env.EMBEDDING_MODEL ?? await getDefaultEmbeddingModel();
  const batchSize = 20;
  const results: { text: string; index: number; embedding: number[] | null }[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);

    try {
      const resp = await fetch(`${LITELLM_URL}/v1/embeddings`, {
        method: "POST",
        headers: litellmHeaders(),
        body: JSON.stringify({ model: embeddingModel, input: texts }),
      });

      if (!resp.ok) {
        console.warn(`[EMBED] LiteLLM returned ${resp.status}, skipping batch`);
        results.push(...batch.map((c) => ({ ...c, embedding: null })));
        continue;
      }

      const data = await resp.json() as { data: { embedding: number[]; index: number }[] };
      for (const item of data.data) {
        results.push({ ...batch[item.index], embedding: item.embedding });
      }
    } catch (err) {
      console.warn(`[EMBED] Embedding API error, skipping batch:`, err);
      results.push(...batch.map((c) => ({ ...c, embedding: null })));
    }
  }

  return results;
}

async function persistChunks(
  documentId: string,
  collectionId: string,
  chunks: { text: string; index: number; embedding: number[] | null }[],
): Promise<void> {
  const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId));
  const orgId = doc?.orgId ?? "";

  for (const chunk of chunks) {
    await db.insert(knowledgeChunks).values({
      knowledgeDocumentId: documentId,
      knowledgeCollectionId: collectionId,
      orgId,
      content: chunk.text,
      embedding: chunk.embedding,
      chunkIndex: chunk.index,
      tokenCount: Math.ceil(chunk.text.length / 4),
      metadata: {},
    });
  }

  await db.update(knowledgeDocuments).set({
    chunkCount: chunks.length,
    status: "ready",
    updatedAt: new Date(),
  }).where(eq(knowledgeDocuments.id, documentId));
}

/**
 * Single activity that does the entire ingestion pipeline:
 * fetch content → chunk → embed → store.
 * This avoids passing large data through Temporal's 4MB gRPC message limit.
 * Returns only a small summary.
 */
export async function ingestDocument(input: DocumentIngestionInput): Promise<{ chunkCount: number }> {
  const content = await resolveDocumentContent(input);
  const chunks = splitIntoChunks(content);
  const withEmbeddings = await embedChunks(chunks);
  await persistChunks(input.documentId, input.collectionId, withEmbeddings);
  return { chunkCount: withEmbeddings.length };
}

// Legacy exports kept for any in-flight workflows
export async function fetchAndChunkDocument(input: DocumentIngestionInput): Promise<{ text: string; index: number }[]> {
  const content = await resolveDocumentContent(input);
  return splitIntoChunks(content);
}
export async function fetchDocumentContent(input: DocumentIngestionInput): Promise<string> {
  return resolveDocumentContent(input);
}
export async function chunkDocument(_documentId: string, content: string): Promise<{ text: string; index: number }[]> {
  return splitIntoChunks(content);
}
export async function generateEmbeddings(
  chunks: { text: string; index: number }[],
): Promise<{ text: string; index: number; embedding: number[] | null }[]> {
  return embedChunks(chunks);
}
export async function storeChunks(
  documentId: string,
  collectionId: string,
  chunks: { text: string; index: number; embedding: number[] | null }[],
): Promise<void> {
  return persistChunks(documentId, collectionId, chunks);
}

export async function updateDocumentStatus(documentId: string, status: string): Promise<void> {
  await db.update(knowledgeDocuments).set({
    status,
    updatedAt: new Date(),
  }).where(eq(knowledgeDocuments.id, documentId));
}
