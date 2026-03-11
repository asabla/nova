import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { openai } from "../lib/litellm";
import { getDefaultEmbeddingModel } from "../lib/models";
import { knowledgeDocuments, knowledgeChunks, knowledgeCollections } from "@nova/shared/schemas";
import { files } from "@nova/shared/schema";
import { extractFromHtml, chunkContent } from "@nova/shared/content";
import type { ContentChunk } from "@nova/shared/content";
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

/** Minimum characters of extracted text to consider a PDF extraction successful */
const PDF_MIN_TEXT_LENGTH = 50;

/**
 * Extract text from a PDF buffer. Tries unpdf (pdfjs) first for speed,
 * then falls back to mupdf page rendering + tesseract.js OCR for PDFs
 * that render text as vector paths (e.g. Firefox "Print to PDF" on macOS).
 */
async function extractPdfText(fileBuffer: Buffer): Promise<string> {
  // 1. Try unpdf (fast, works for most PDFs)
  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(fileBuffer));
    const pages = result.text;
    const text = Array.isArray(pages) ? pages.join("\n") : String(pages);
    if (text.trim().length >= PDF_MIN_TEXT_LENGTH) {
      return text;
    }
    console.warn("[PDF] unpdf returned insufficient text, trying OCR fallback");
  } catch (err) {
    console.warn("[PDF] unpdf extraction failed, trying OCR fallback:", err);
  }

  // 2. Fallback: render pages with mupdf → OCR with tesseract.js
  const mupdf = await import("mupdf");
  const { createWorker } = await import("tesseract.js");

  const doc = mupdf.Document.openDocument(fileBuffer, "application/pdf");
  const pageCount = doc.countPages();
  const ocrWorker = await createWorker("eng");
  const pageTexts: string[] = [];

  try {
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      // Render at 2x scale for better OCR accuracy
      const pixmap = page.toPixmap(
        [2, 0, 0, 2, 0, 0],
        mupdf.ColorSpace.DeviceRGB,
        false,
        true,
      );
      const png = pixmap.asPNG();
      const { data: { text } } = await ocrWorker.recognize(Buffer.from(png));
      pageTexts.push(text);
    }
  } finally {
    await ocrWorker.terminate();
  }

  const fullText = pageTexts.join("\n\n");
  if (fullText.trim().length === 0) {
    console.warn("[PDF] OCR also returned no text (image-only PDF with no recognizable text)");
  }
  return fullText;
}

interface ResolvedContent {
  text: string;
  title?: string;
  sourceUrl?: string;
}

function isHtmlContent(text: string, contentType?: string): boolean {
  if (contentType && (contentType.includes("text/html") || contentType.includes("xhtml"))) return true;
  const trimmed = text.trimStart().slice(0, 500).toLowerCase();
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html");
}

async function resolveDocumentContent(input: DocumentIngestionInput): Promise<ResolvedContent> {
  const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, input.documentId));
  if (!doc) throw new Error(`Document ${input.documentId} not found`);

  if (doc.content) {
    // Stored content might be HTML
    if (isHtmlContent(doc.content)) {
      const extracted = extractFromHtml(doc.content, doc.sourceUrl ?? undefined);
      return { text: extracted.markdown, title: extracted.title ?? undefined, sourceUrl: doc.sourceUrl ?? undefined };
    }
    return { text: doc.content };
  }

  if (doc.sourceUrl || input.sourceUrl) {
    const url = doc.sourceUrl ?? input.sourceUrl!;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch URL ${url}: ${resp.status}`);
    const contentType = resp.headers.get("content-type") ?? "";
    const body = await resp.text();

    if (isHtmlContent(body, contentType)) {
      const extracted = extractFromHtml(body, url);
      return { text: extracted.markdown, title: extracted.title ?? undefined, sourceUrl: url };
    }
    return { text: body, sourceUrl: url };
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
      const text = await extractPdfText(fileBuffer);
      return { text };
    }

    const text = fileBuffer.toString("utf-8");
    if (isHtmlContent(text, ct)) {
      const extracted = extractFromHtml(text);
      return { text: extracted.markdown, title: extracted.title ?? undefined };
    }
    return { text };
  }

  return { text: "" };
}

interface EmbeddedChunk extends ContentChunk {
  embedding: number[] | null;
}

async function embedChunks(
  chunks: ContentChunk[],
  embeddingModelOverride?: string,
): Promise<EmbeddedChunk[]> {
  const embeddingModel = embeddingModelOverride ?? process.env.EMBEDDING_MODEL ?? await getDefaultEmbeddingModel();
  const batchSize = 20;
  const results: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    // Prepend section heading for better embedding context
    const texts = batch.map((c) => {
      const prefix = c.metadata.sectionHeading ? `[${c.metadata.sectionHeading}] ` : "";
      return prefix + c.text;
    });

    try {
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: texts,
      });

      for (const item of response.data) {
        // Discard zero vectors (model returned empty/invalid embedding)
        const isZero = item.embedding.every((v) => v === 0);
        results.push({ ...batch[item.index], embedding: isZero ? null : item.embedding });
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
  chunks: EmbeddedChunk[],
  documentTitle?: string,
  sourceUrl?: string,
): Promise<void> {
  const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId));
  const orgId = doc?.orgId ?? "";

  // Delete any existing chunks for this document (handles re-indexing)
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.knowledgeDocumentId, documentId));

  for (const chunk of chunks) {
    await db.insert(knowledgeChunks).values({
      knowledgeDocumentId: documentId,
      knowledgeCollectionId: collectionId,
      orgId,
      content: chunk.text,
      embedding: chunk.embedding,
      chunkIndex: chunk.index,
      tokenCount: Math.ceil(chunk.text.length / 4),
      metadata: {
        ...chunk.metadata,
        documentTitle,
        sourceUrl,
      },
    });
  }

  // Update document with title if we extracted one and it's not already set
  const updateData: Record<string, unknown> = {
    chunkCount: chunks.length,
    status: "ready",
    updatedAt: new Date(),
  };
  if (documentTitle && !doc?.title) {
    updateData.title = documentTitle;
  }

  await db.update(knowledgeDocuments).set(updateData).where(eq(knowledgeDocuments.id, documentId));
}

/**
 * Single activity that does the entire ingestion pipeline:
 * fetch content -> chunk (semantic) -> embed -> store.
 * This avoids passing large data through Temporal's 4MB gRPC message limit.
 * Returns only a small summary.
 */
export async function ingestDocument(input: DocumentIngestionInput): Promise<{ chunkCount: number }> {
  const resolved = await resolveDocumentContent(input);

  if (!resolved.text.trim()) {
    throw new Error("No text could be extracted from the document");
  }

  // Fetch collection settings for chunk size/overlap and embedding model
  const [collection] = await db
    .select({
      chunkSize: knowledgeCollections.chunkSize,
      chunkOverlap: knowledgeCollections.chunkOverlap,
      embeddingModel: knowledgeCollections.embeddingModel,
    })
    .from(knowledgeCollections)
    .where(eq(knowledgeCollections.id, input.collectionId));

  const chunks = chunkContent(resolved.text, {
    maxChunkSize: collection?.chunkSize ?? 1500,
    overlap: collection?.chunkOverlap ?? 150,
  });

  if (chunks.length === 0) {
    throw new Error("Document produced no chunks after processing");
  }

  const withEmbeddings = await embedChunks(chunks, collection?.embeddingModel ?? undefined);
  await persistChunks(input.documentId, input.collectionId, withEmbeddings, resolved.title, resolved.sourceUrl);
  return { chunkCount: withEmbeddings.length };
}

// Legacy exports kept for any in-flight workflows
export async function fetchAndChunkDocument(input: DocumentIngestionInput): Promise<ContentChunk[]> {
  const resolved = await resolveDocumentContent(input);
  return chunkContent(resolved.text);
}
export async function fetchDocumentContent(input: DocumentIngestionInput): Promise<string> {
  const resolved = await resolveDocumentContent(input);
  return resolved.text;
}
export async function chunkDocument(_documentId: string, content: string): Promise<ContentChunk[]> {
  return chunkContent(content);
}
export async function generateEmbeddings(
  chunks: ContentChunk[],
): Promise<EmbeddedChunk[]> {
  return embedChunks(chunks);
}
export async function storeChunks(
  documentId: string,
  collectionId: string,
  chunks: EmbeddedChunk[],
): Promise<void> {
  return persistChunks(documentId, collectionId, chunks);
}

export async function updateDocumentStatus(documentId: string, status: string): Promise<void> {
  await db.update(knowledgeDocuments).set({
    status,
    updatedAt: new Date(),
  }).where(eq(knowledgeDocuments.id, documentId));
}
