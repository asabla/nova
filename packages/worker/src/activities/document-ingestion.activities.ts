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
  return doc?.rawContent ?? "";
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
  // In production, call the embedding API (e.g., OpenAI, LiteLLM)
  // For now, return placeholder embeddings
  return chunks.map((chunk) => ({
    ...chunk,
    embedding: new Array(1536).fill(0).map(() => Math.random() * 2 - 1),
  }));
}

export async function storeChunks(
  documentId: string,
  collectionId: string,
  chunks: { text: string; index: number; embedding: number[] }[],
): Promise<void> {
  for (const chunk of chunks) {
    await db.insert(knowledgeChunks).values({
      documentId,
      collectionId,
      content: chunk.text,
      chunkIndex: chunk.index,
      tokenCount: Math.ceil(chunk.text.length / 4),
      metadata: {},
    });
  }

  await db.update(knowledgeDocuments).set({
    chunkCount: chunks.length,
    status: "ready",
    processedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(knowledgeDocuments.id, documentId));
}

export async function updateDocumentStatus(documentId: string, status: string): Promise<void> {
  await db.update(knowledgeDocuments).set({
    status,
    updatedAt: new Date(),
  }).where(eq(knowledgeDocuments.id, documentId));
}
