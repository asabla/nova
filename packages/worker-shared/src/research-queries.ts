import { eq, and, inArray, isNull, sql, desc } from "drizzle-orm";
import { db } from "./db.js";
import { knowledgeChunks, knowledgeDocuments, files, fileChunks } from "@nova/shared/schemas";

export interface KnowledgeChunkResult {
  collectionId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  fileId?: string;
  sourceUrl?: string;
  timestampUrl?: string;
  chapterTitle?: string;
}

export async function queryKnowledgeCollections(
  orgId: string,
  collectionIds: string[],
  query: string,
  topK: number,
): Promise<KnowledgeChunkResult[]> {
  if (collectionIds.length === 0) return [];

  // Use text similarity search (pg_trgm) since the worker may not have the embedding model.
  const results = await db
    .select({
      id: knowledgeChunks.id,
      collectionId: knowledgeChunks.knowledgeCollectionId,
      documentId: knowledgeChunks.knowledgeDocumentId,
      content: knowledgeChunks.content,
      metadata: knowledgeChunks.metadata,
      score: sql<number>`similarity(${knowledgeChunks.content}, ${query})`.as("score"),
    })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.orgId, orgId),
        inArray(knowledgeChunks.knowledgeCollectionId, collectionIds),
        isNull(knowledgeChunks.deletedAt),
      ),
    )
    .orderBy(desc(sql`similarity(${knowledgeChunks.content}, ${query})`))
    .limit(topK);

  // Fetch document names and fileIds for the matched chunks
  const docIds = [...new Set(results.map((r) => r.documentId))];
  const docs = docIds.length > 0
    ? await db
        .select({ id: knowledgeDocuments.id, title: knowledgeDocuments.title, fileId: knowledgeDocuments.fileId })
        .from(knowledgeDocuments)
        .where(inArray(knowledgeDocuments.id, docIds))
    : [];
  const docNameMap = new Map(docs.map((d) => [d.id, d.title ?? "Untitled"]));
  const docFileMap = new Map(docs.map((d) => [d.id, d.fileId ?? undefined]));

  return results.map((r) => {
    const meta = r.metadata as Record<string, unknown> | null;
    return {
      collectionId: r.collectionId,
      documentId: r.documentId,
      documentName: docNameMap.get(r.documentId) ?? "Untitled",
      content: r.content,
      score: r.score ?? 0,
      fileId: docFileMap.get(r.documentId),
      sourceUrl: (meta?.sourceUrl as string) ?? undefined,
      timestampUrl: (meta?.timestampUrl as string) ?? undefined,
      chapterTitle: (meta?.chapterTitle as string) ?? undefined,
    };
  });
}

const TABULAR_MIME_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function isTabularFile(contentType: string | null, filename: string): boolean {
  if (contentType && TABULAR_MIME_TYPES.has(contentType)) return true;
  const ext = filename.toLowerCase();
  return ext.endsWith(".csv") || ext.endsWith(".xlsx") || ext.endsWith(".xls");
}

export async function fetchFileContents(
  orgId: string,
  fileIds: string[],
): Promise<{ fileId: string; filename: string; content: string }[]> {
  if (fileIds.length === 0) return [];

  const fileRecords = await db
    .select({ id: files.id, filename: files.filename, contentType: files.contentType })
    .from(files)
    .where(
      and(
        eq(files.orgId, orgId),
        inArray(files.id, fileIds),
        isNull(files.deletedAt),
      ),
    );

  const results: { fileId: string; filename: string; content: string }[] = [];

  for (const file of fileRecords) {
    if (isTabularFile(file.contentType, file.filename)) {
      const [knDoc] = await db
        .select({ summary: knowledgeDocuments.summary, metadata: knowledgeDocuments.metadata })
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.fileId, file.id),
            eq(knowledgeDocuments.orgId, orgId),
          ),
        )
        .limit(1);

      const meta = knDoc?.metadata as Record<string, unknown> | null;
      let descriptor = `[Tabular file: "${file.filename}" (${file.contentType})]`;
      if (knDoc?.summary) {
        descriptor += `\nSummary: ${knDoc.summary}`;
      }
      if (meta?.sheets) {
        const sheets = meta.sheets as { name: string; rowCount: number; columns: string[]; dataTypes: Record<string, string> }[];
        for (const sheet of sheets) {
          descriptor += `\nSheet "${sheet.name}": ${sheet.rowCount} rows, columns: ${sheet.columns.join(", ")}`;
          const types = Object.entries(sheet.dataTypes).map(([col, t]) => `${col}(${t})`).join(", ");
          descriptor += ` [types: ${types}]`;
        }
      } else if (meta?.totalRows) {
        descriptor += `\nTotal rows: ${meta.totalRows}`;
      }
      descriptor += `\n\nThis is a structured data file. To analyze its contents, use code_execute with input_file_ids: ["${file.id}"] and write Python/pandas code to read and process the file from /sandbox/input/${file.filename}`;

      results.push({ fileId: file.id, filename: file.filename, content: descriptor });
      continue;
    }

    // Text files: retrieve pre-chunked content from file_chunks table
    const chunks = await db
      .select({ content: fileChunks.content, chunkIndex: fileChunks.chunkIndex })
      .from(fileChunks)
      .where(
        and(
          eq(fileChunks.fileId, file.id),
          eq(fileChunks.orgId, orgId),
          isNull(fileChunks.deletedAt),
        ),
      )
      .orderBy(fileChunks.chunkIndex);

    const content = chunks.map((c) => c.content).join("\n\n");
    if (content.length > 0) {
      results.push({ fileId: file.id, filename: file.filename, content: content.slice(0, 50_000) });
    }
  }

  return results;
}
