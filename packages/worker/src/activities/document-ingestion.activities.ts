import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { getDefaultEmbeddingModel } from "../lib/models";
import { knowledgeDocuments, knowledgeChunks } from "@nova/shared/schemas";
import type { DocumentIngestionInput } from "../workflows/document-ingestion";

export async function fetchDocumentContent(input: DocumentIngestionInput): Promise<string> {
  if (input.sourceUrl) {
    const resp = await fetch(input.sourceUrl);
    return resp.text();
  }

  const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, input.documentId));
  return doc?.sourceUrl ? await (await fetch(doc.sourceUrl)).text() : "";
}

export async function chunkDocument(documentId: string, content: string): Promise<{ text: string; index: number }[]> {
  const CHUNK_SIZE = 1000;
  const OVERLAP = 200;
  const chunks: { text: string; index: number }[] = [];

  let start = 0;
  let index = 0;
  while (start < content.length) {
    const end = Math.min(start + CHUNK_SIZE, content.length);
    chunks.push({ text: content.slice(start, end), index });
    start += CHUNK_SIZE - OVERLAP;
    index++;
  }

  return chunks;
}

export async function generateEmbeddings(
  chunks: { text: string; index: number }[],
): Promise<{ text: string; index: number; embedding: number[] | null }[]> {
  const litellmUrl = process.env.LITELLM_URL ?? "http://localhost:4000";
  const embeddingModel = process.env.EMBEDDING_MODEL ?? await getDefaultEmbeddingModel();
  const batchSize = 20;
  const results: { text: string; index: number; embedding: number[] | null }[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);

    try {
      const resp = await fetch(`${litellmUrl}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: embeddingModel,
          input: texts,
        }),
      });

      if (!resp.ok) {
        console.warn(`[EMBED] LiteLLM returned ${resp.status}, skipping embeddings for batch`);
        results.push(...batch.map((c) => ({ ...c, embedding: null })));
        continue;
      }

      const data = await resp.json() as { data: { embedding: number[]; index: number }[] };
      for (const item of data.data) {
        results.push({
          ...batch[item.index],
          embedding: item.embedding,
        });
      }
    } catch (err) {
      console.warn(`[EMBED] Failed to call embedding API, skipping embeddings:`, err);
      results.push(...batch.map((c) => ({ ...c, embedding: null })));
    }
  }

  return results;
}

export async function storeChunks(
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

export async function updateDocumentStatus(documentId: string, status: string): Promise<void> {
  await db.update(knowledgeDocuments).set({
    status,
    updatedAt: new Date(),
  }).where(eq(knowledgeDocuments.id, documentId));
}
