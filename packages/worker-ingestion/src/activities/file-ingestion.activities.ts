import { eq } from "drizzle-orm";
import { Context } from "@temporalio/activity";
import { randomUUID } from "crypto";
import { db } from "@nova/worker-shared/db";
import { openai } from "@nova/worker-shared/litellm";
import { files } from "@nova/shared/schema";
import { chunkContent } from "@nova/shared/content";
import { decodeBuffer, stripNullBytes } from "@nova/shared/utils";
import { upsertPoints, deletePointsByFilter, COLLECTIONS } from "@nova/worker-shared/qdrant";
import { getDefaultEmbeddingModel } from "@nova/worker-shared/models";
import { logger } from "@nova/worker-shared/logger";

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

/**
 * Download file from MinIO, extract text content, chunk, embed, and upsert to Qdrant.
 */
export async function ingestFileContent(fileId: string, orgId: string): Promise<void> {
  const [file] = await db.select().from(files).where(eq(files.id, fileId));
  if (!file) return;

  const ct = (file.contentType ?? "").toLowerCase();

  // Download file from MinIO
  const minio = await getMinioClient();
  const bucket = process.env.MINIO_BUCKET ?? "nova-files";
  const stream = await minio.getObject(bucket, file.storagePath);
  const buffers: Buffer[] = [];
  for await (const chunk of stream) {
    buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const fileBuffer = Buffer.concat(buffers);

  // Extract text based on content type
  let text = "";

  if (ct === "application/pdf" || file.filename?.toLowerCase().endsWith(".pdf")) {
    try {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(fileBuffer));
      const pages = result.text;
      text = Array.isArray(pages) ? pages.join("\n") : String(pages);
    } catch {
      logger.warn({ fileId }, "[file-ingest] PDF extraction failed");
      return;
    }
  } else if (ct === "text/csv" || file.filename?.toLowerCase().endsWith(".csv")) {
    // CSV — extract descriptor (schema + samples) for RAG, not raw row data
    try {
      const { extractCsv, tabularToDescriptor } = await import("../lib/extract-tabular");
      const data = await extractCsv(fileBuffer, file.filename ?? undefined);
      text = tabularToDescriptor(data);
      // Store tabular metadata on the file record
      await db.update(files).set({
        metadata: {
          tabular: {
            totalRows: data.metadata.totalRows,
            sheetCount: data.metadata.sheetCount,
            columns: data.sheets[0]?.columns.length ?? 0,
          },
        },
      }).where(eq(files.id, fileId));
    } catch {
      logger.warn({ fileId }, "[file-ingest] CSV extraction failed, falling back to raw text");
      text = decodeBuffer(fileBuffer, { contentType: ct });
    }
  } else if (ct === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    // XLSX — extract descriptor (schema + samples) for RAG
    try {
      const { extractXlsx, tabularToDescriptor } = await import("../lib/extract-tabular");
      const data = await extractXlsx(fileBuffer, file.filename ?? undefined);
      text = tabularToDescriptor(data);
      // Store tabular metadata on the file record
      await db.update(files).set({
        metadata: {
          tabular: {
            totalRows: data.metadata.totalRows,
            sheetCount: data.metadata.sheetCount,
            columns: data.sheets[0]?.columns.length ?? 0,
          },
        },
      }).where(eq(files.id, fileId));
    } catch {
      logger.warn({ fileId }, "[file-ingest] XLSX extraction failed");
      return;
    }
  } else if (ct.startsWith("image/")) {
    // Images — use vision extraction
    try {
      const { extractImageContent } = await import("../lib/extract-image");
      const result = await extractImageContent(fileBuffer, ct, file.filename ?? undefined);
      text = result.text;
    } catch {
      logger.warn({ fileId }, "[file-ingest] Image extraction failed");
      return;
    }
  } else {
    // Plain text, markdown, HTML, etc.
    text = decodeBuffer(fileBuffer, { contentType: ct });
  }

  text = stripNullBytes(text).trim();
  if (!text) return;

  // Chunk
  const chunks = chunkContent(text, { maxChunkSize: 1500, overlap: 150 });
  if (chunks.length === 0) return;

  // Embed in batches
  const embeddingModel = process.env.EMBEDDING_MODEL ?? await getDefaultEmbeddingModel();
  const batchSize = 20;
  const points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }> = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    Context.current().heartbeat(`Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);

    try {
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: texts,
      });

      for (const item of response.data) {
        const isZero = item.embedding.every((v) => v === 0);
        if (isZero) continue;

        const chunk = batch[item.index];
        points.push({
          id: randomUUID(),
          vector: item.embedding,
          payload: {
            orgId,
            fileId,
            filename: file.filename ?? null,
            contentType: ct,
            chunkIndex: chunk.index,
            content: chunk.text.slice(0, 10_000),
            tokenCount: Math.ceil(chunk.text.length / 4),
            createdAt: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      logger.warn({ err }, "[file-ingest] Embedding batch failed");
    }
  }

  if (points.length === 0) return;

  // Delete existing chunks for this file, then upsert
  await deletePointsByFilter(COLLECTIONS.FILE_CHUNKS, {
    must: [{ key: "fileId", match: { value: fileId } }],
  });
  await upsertPoints(COLLECTIONS.FILE_CHUNKS, points);
}
