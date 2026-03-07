import { eq } from "drizzle-orm";
import { db } from "../lib/db";
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
): Promise<{ text: string; index: number; embedding: number[] }[]> {
  const litellmUrl = process.env.LITELLM_URL ?? "http://localhost:4000";
  const batchSize = 20;
  const results: { text: string; index: number; embedding: number[] }[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);

    try {
      const resp = await fetch(`${litellmUrl}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
          input: texts,
        }),
      });

      if (!resp.ok) {
        console.warn(`[EMBED] LiteLLM returned ${resp.status}, falling back to zero vectors`);
        results.push(...batch.map((c) => ({
          ...c,
          embedding: new Array(1536).fill(0),
        })));
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
      console.warn(`[EMBED] Failed to call embedding API, using zero vectors:`, err);
      results.push(...batch.map((c) => ({
        ...c,
        embedding: new Array(1536).fill(0),
      })));
    }
  }

  return results;
}

export async function storeChunks(
  documentId: string,
  collectionId: string,
  chunks: { text: string; index: number; embedding: number[] }[],
): Promise<void> {
  for (const chunk of chunks) {
    await db.insert(knowledgeChunks).values({
      knowledgeDocumentId: documentId,
      knowledgeCollectionId: collectionId,
      orgId: (await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId)))[0]?.orgId ?? "",
      content: chunk.text,
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
