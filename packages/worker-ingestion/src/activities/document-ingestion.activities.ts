import { eq, and } from "drizzle-orm";
import { Context } from "@temporalio/activity";
import { db } from "@nova/worker-shared/db";
import { openai } from "@nova/worker-shared/litellm";
import { getDefaultEmbeddingModel } from "@nova/worker-shared/models";
import { knowledgeDocuments, knowledgeChunks, knowledgeCollections, knowledgeTags, knowledgeDocumentTagAssignments } from "@nova/shared/schemas";
import { files } from "@nova/shared/schema";
import { extractFromHtml, chunkContent } from "@nova/shared/content";
import { decodeBuffer, stripNullBytes } from "@nova/shared/utils";
import type { ContentChunk } from "@nova/shared/content";
import type { DocumentIngestionInput } from "../workflows/document-ingestion";
import { extractCsv, extractXlsx, tabularToDescriptor } from "../lib/extract-tabular";
import { extractImageContent } from "../lib/extract-image";
import { extractPptxContent } from "../lib/extract-pptx";
import { upsertPoints, deletePointsByFilter, COLLECTIONS } from "@nova/worker-shared/qdrant";

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
 * Detects garbled text from failed CMap/font encoding in PDF extraction.
 * Checks for unnatural uppercase ratios, long words, and consonant clusters.
 */
export function isLikelyGarbledText(text: string): boolean {
  const sample = text.replace(/\s+/g, " ").trim().slice(0, 1000);
  if (sample.length < 50) return false;

  const words = sample.split(/\s+/);
  if (words.length === 0) return false;

  // 1. Average word length — natural text averages 4-8 chars
  const avgWordLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  if (avgWordLen > 15) return true;

  // 2. Uppercase ratio — garbled CMap text is often heavily uppercase
  const alphaChars = sample.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (alphaChars.length > 0) {
    const upperRatio = alphaChars.replace(/[^A-ZÀ-Ý]/g, "").length / alphaChars.length;
    if (upperRatio > 0.6) return true;
  }

  // 3. Consecutive consonant clusters — garbled text has implausible sequences
  const longConsonantRun = /[^aeiouåäöAEIOUÅÄÖ\s\d.,;:!?()-]{8,}/g;
  const consonantMatches = sample.match(longConsonantRun);
  if (consonantMatches && consonantMatches.length > words.length * 0.3) return true;

  return false;
}

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
    if (text.trim().length >= PDF_MIN_TEXT_LENGTH && !isLikelyGarbledText(text)) {
      return text;
    }
    console.warn("[PDF] unpdf returned garbled or insufficient text, trying OCR fallback");
  } catch (err) {
    console.warn("[PDF] unpdf extraction failed, trying OCR fallback:", err);
  }

  // 2. Fallback: render pages with mupdf → OCR with tesseract.js
  const mupdf = await import("mupdf");
  const { createWorker } = await import("tesseract.js");

  const doc = mupdf.Document.openDocument(fileBuffer, "application/pdf");
  const pageCount = doc.countPages();
  const ocrLangs = process.env.OCR_LANGUAGES ?? "eng+swe";
  const ocrWorker = await createWorker(ocrLangs);
  const pageTexts: string[] = [];

  try {
    for (let i = 0; i < pageCount; i++) {
      Context.current().heartbeat(`OCR page ${i + 1}/${pageCount}`);
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

interface ExtractedMetadata {
  byline?: string | null;
  publishedDate?: string | null;
  description?: string | null;
  language?: string | null;
  siteName?: string | null;
  wordCount?: number;
}

interface ResolvedContent {
  text: string;
  title?: string;
  sourceUrl?: string;
  extractedMetadata?: ExtractedMetadata;
  documentMetadata?: Record<string, unknown>;
  fileType?: string;
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
      return {
        text: extracted.markdown,
        title: extracted.title ?? undefined,
        sourceUrl: doc.sourceUrl ?? undefined,
        extractedMetadata: { byline: extracted.byline, publishedDate: extracted.publishedDate, description: extracted.description, language: extracted.language, siteName: extracted.siteName, wordCount: extracted.wordCount },
      };
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
      return {
        text: extracted.markdown,
        title: extracted.title ?? undefined,
        sourceUrl: url,
        extractedMetadata: { byline: extracted.byline, publishedDate: extracted.publishedDate, description: extracted.description, language: extracted.language, siteName: extracted.siteName, wordCount: extracted.wordCount },
      };
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

    // Tabular data — CSV
    if (ct === "text/csv" || fileRecord.filename?.toLowerCase().endsWith(".csv")) {
      const data = await extractCsv(fileBuffer, fileRecord.filename ?? undefined);
      const descriptor = tabularToDescriptor(data);
      const codeHint = `\n\nFile ID: ${fileId}\nTo analyze this data, use code_execute with input_file_ids: ["${fileId}"] and read /sandbox/input/${fileRecord.filename} with Python/pandas.`;
      return {
        text: descriptor + codeHint,
        fileType: "tabular",
        documentMetadata: {
          fileType: "tabular",
          format: "csv",
          fileId,
          sheetCount: data.metadata.sheetCount,
          totalRows: data.metadata.totalRows,
          sheets: data.sheets.map((s) => ({
            name: s.name,
            rowCount: s.rowCount,
            columns: s.columns,
            dataTypes: s.dataTypes,
          })),
        },
      };
    }

    // Tabular data — XLSX
    if (ct === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || fileRecord.filename?.toLowerCase().endsWith(".xlsx")) {
      const data = await extractXlsx(fileBuffer, fileRecord.filename ?? undefined);
      const descriptor = tabularToDescriptor(data);
      const codeHint = `\n\nFile ID: ${fileId}\nTo analyze this data, use code_execute with input_file_ids: ["${fileId}"] and read /sandbox/input/${fileRecord.filename} with Python/pandas or openpyxl.`;
      return {
        text: descriptor + codeHint,
        fileType: "tabular",
        documentMetadata: {
          fileType: "tabular",
          format: "xlsx",
          fileId,
          sheetCount: data.metadata.sheetCount,
          totalRows: data.metadata.totalRows,
          sheets: data.sheets.map((s) => ({
            name: s.name,
            rowCount: s.rowCount,
            columns: s.columns,
            dataTypes: s.dataTypes,
          })),
        },
      };
    }

    // PPTX presentations
    if (ct === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || fileRecord.filename?.toLowerCase().endsWith(".pptx")) {
      const result = await extractPptxContent(fileBuffer, ct, fileRecord.filename ?? "presentation.pptx", input.orgId, fileRecord.storagePath);
      return {
        text: result.text,
        fileType: "presentation",
        documentMetadata: result.documentMetadata as Record<string, unknown>,
      };
    }

    // Images — vision + OCR
    if (ct.startsWith("image/")) {
      const result = await extractImageContent(fileBuffer, ct, fileRecord.filename ?? undefined);
      return {
        text: result.text,
        fileType: "image",
        documentMetadata: result.documentMetadata as Record<string, unknown>,
      };
    }

    const text = decodeBuffer(fileBuffer, { contentType: ct });
    if (isHtmlContent(text, ct)) {
      const extracted = extractFromHtml(text);
      return {
        text: extracted.markdown,
        title: extracted.title ?? undefined,
        extractedMetadata: { byline: extracted.byline, publishedDate: extracted.publishedDate, description: extracted.description, language: extracted.language, siteName: extracted.siteName, wordCount: extracted.wordCount },
      };
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
    Context.current().heartbeat(`Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
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
  fullText?: string,
): Promise<void> {
  const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId));
  const orgId = doc?.orgId ?? "";

  // Delete any existing chunks for this document (handles re-indexing)
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.knowledgeDocumentId, documentId));
  await deletePointsByFilter(COLLECTIONS.KNOWLEDGE_CHUNKS, {
    must: [{ key: "documentId", match: { value: documentId } }],
  }).catch((err) => console.warn("[qdrant] Failed to delete old chunks:", err));

  const qdrantPoints: Array<{ id: string; vector?: number[]; payload: Record<string, unknown> }> = [];

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
        documentTitle,
        sourceUrl,
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
          documentTitle: documentTitle ?? null,
          sourceUrl: sourceUrl ?? null,
          sectionHeading: chunk.metadata.sectionHeading ?? null,
          createdAt: new Date().toISOString(),
        },
      });
    }
  }

  // Upsert to Qdrant
  if (qdrantPoints.length > 0) {
    await upsertPoints(COLLECTIONS.KNOWLEDGE_CHUNKS, qdrantPoints).catch((err) =>
      console.warn("[qdrant] Failed to upsert knowledge chunks:", err),
    );
  }

  // Update document with title, content, tokenCount
  const totalTokens = chunks.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0);
  const updateData: Record<string, unknown> = {
    chunkCount: chunks.length,
    tokenCount: totalTokens,
    status: "ready",
    updatedAt: new Date(),
  };
  if (documentTitle && !doc?.title) {
    updateData.title = documentTitle;
  }
  if (fullText && !doc?.content) {
    updateData.content = fullText;
  }

  await db.update(knowledgeDocuments).set(updateData).where(eq(knowledgeDocuments.id, documentId));
}

interface EnrichmentResult {
  summary: string;
  tags: string[];
  category: string;
}

async function enrichDocument(text: string, title?: string, fileType?: string): Promise<EnrichmentResult | null> {
  try {
    const model = process.env.ENRICHMENT_MODEL ?? "gpt-5.4";
    const snippet = text.slice(0, 4000);

    let typeSpecificInstructions = "";
    if (fileType === "tabular") {
      typeSpecificInstructions = `\nThis is tabular/spreadsheet data. Focus tags on: data domain, column topics, data category (e.g. "financial-data", "sales", "quarterly-report").`;
    } else if (fileType === "image") {
      typeSpecificInstructions = `\nThis is an image description. Focus tags on: content type, subjects, visual style (e.g. "photograph", "chart", "diagram", "screenshot").`;
    } else if (fileType === "presentation") {
      typeSpecificInstructions = `\nThis is a presentation/slideshow. Focus tags on: topic, audience, presentation type (e.g. "quarterly-review", "product-roadmap", "training").`;
    }

    const prompt = `Analyze this document and return a JSON object with:
- "summary": a 2-3 sentence summary of the document
- "tags": an array of 3-7 descriptive tags (lowercase, no #)
- "category": a single category label (e.g. "tutorial", "research", "news", "documentation", "blog", "reference", "dataset", "image", "presentation")
${typeSpecificInstructions}
${title ? `Title: ${title}\n` : ""}Content:
${snippet}`;

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as EnrichmentResult;
    return {
      summary: parsed.summary ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 10) : [],
      category: parsed.category ?? "",
    };
  } catch (err) {
    console.warn("[ENRICH] LLM enrichment failed, continuing without:", err);
    return null;
  }
}

async function persistEnrichment(
  documentId: string,
  orgId: string,
  extractedMetadata: ExtractedMetadata | undefined,
  enrichment: EnrichmentResult | null,
  documentMetadata?: Record<string, unknown>,
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const mergedMetadata: Record<string, unknown> = {};
  if (extractedMetadata) Object.assign(mergedMetadata, extractedMetadata);
  if (documentMetadata) Object.assign(mergedMetadata, documentMetadata);
  if (Object.keys(mergedMetadata).length > 0) updates.metadata = mergedMetadata;
  if (enrichment?.summary) updates.summary = enrichment.summary;

  await db.update(knowledgeDocuments).set(updates).where(eq(knowledgeDocuments.id, documentId));

  if (enrichment && enrichment.tags.length > 0) {
    // Collect all tags including category
    const tagNames = [...enrichment.tags];
    if (enrichment.category) tagNames.push(enrichment.category);
    const uniqueTags = [...new Set(tagNames.map((t) => t.toLowerCase().trim()).filter(Boolean))];

    // Clear existing auto-generated assignments for this document
    await db.delete(knowledgeDocumentTagAssignments).where(
      and(
        eq(knowledgeDocumentTagAssignments.knowledgeDocumentId, documentId),
        eq(knowledgeDocumentTagAssignments.source, "auto"),
      ),
    );

    for (const tagName of uniqueTags) {
      // Upsert tag
      await db.insert(knowledgeTags).values({
        orgId,
        name: tagName,
        source: "auto",
      }).onConflictDoNothing({ target: [knowledgeTags.orgId, knowledgeTags.name] });

      // Fetch the tag ID
      const [tag] = await db.select({ id: knowledgeTags.id }).from(knowledgeTags).where(
        and(eq(knowledgeTags.orgId, orgId), eq(knowledgeTags.name, tagName)),
      );
      if (!tag) continue;

      // Create assignment
      await db.insert(knowledgeDocumentTagAssignments).values({
        knowledgeDocumentId: documentId,
        knowledgeTagId: tag.id,
        orgId,
        source: "auto",
      }).onConflictDoNothing();
    }
  }
}

/**
 * Single activity that does the entire ingestion pipeline:
 * fetch content -> chunk (semantic) -> embed -> store.
 * This avoids passing large data through Temporal's 4MB gRPC message limit.
 * Returns only a small summary.
 */
export async function ingestDocument(input: DocumentIngestionInput): Promise<{ chunkCount: number }> {
  const resolved = await resolveDocumentContent(input);
  resolved.text = stripNullBytes(resolved.text);
  if (resolved.title) resolved.title = stripNullBytes(resolved.title);

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
  await persistChunks(input.documentId, input.collectionId, withEmbeddings, resolved.title, resolved.sourceUrl, resolved.text);

  // LLM enrichment (non-blocking — failure just skips enrichment)
  Context.current().heartbeat("Enriching document with LLM");
  const enrichment = await enrichDocument(resolved.text, resolved.title, resolved.fileType);
  await persistEnrichment(input.documentId, input.orgId, resolved.extractedMetadata, enrichment, resolved.documentMetadata);

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
