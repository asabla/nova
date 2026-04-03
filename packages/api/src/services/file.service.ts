import { db } from "../lib/db";
import { files } from "@nova/shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { TASK_QUEUES } from "@nova/shared/constants";
import { logger } from "../lib/logger";
import { getUploadUrl, getDownloadUrl, deleteObject } from "../lib/s3";
import { parsePagination, buildPaginatedResponse, type PaginationInput } from "@nova/shared/utils";
import { env } from "../lib/env";
import { syncFileUpsert, syncFileDelete } from "../lib/qdrant-sync";
import { getTemporalClient } from "../lib/temporal";

export async function presignUpload(orgId: string, userId: string, filename: string, contentType: string, sizeBytes: number) {
  const { url, key } = await getUploadUrl(orgId, filename);

  const result = await db.insert(files).values({
    orgId,
    userId,
    filename,
    contentType,
    sizeBytes,
    storagePath: key,
    storageBucket: env.S3_BUCKET,
  }).returning();

  const file = result[0];
  syncFileUpsert(file as any);
  return { uploadUrl: url, fileId: file.id, key };
}

export async function createFileRecord(orgId: string, userId: string, filename: string, contentType: string, sizeBytes: number, storagePath: string) {
  const result = await db.insert(files).values({
    orgId,
    userId,
    filename,
    contentType,
    sizeBytes,
    storagePath,
    storageBucket: env.S3_BUCKET,
  }).returning();
  const file = result[0];
  syncFileUpsert(file as any);
  triggerFileIngestion(file as any);
  return file;
}

export async function confirmUpload(orgId: string, fileId: string) {
  const result = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.orgId, orgId), isNull(files.deletedAt)));
  const file = result[0] ?? null;
  if (file) triggerFileIngestion(file as any);
  return file;
}

export async function getFile(orgId: string, fileId: string) {
  const result = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.orgId, orgId), isNull(files.deletedAt)));
  return result[0] ?? null;
}

export async function getFileDownloadUrl(orgId: string, fileId: string) {
  const file = await getFile(orgId, fileId);
  if (!file) return null;
  const url = await getDownloadUrl(file.storagePath, file.contentType);
  return { url, file };
}

export async function listFiles(orgId: string, userId: string, pagination: PaginationInput) {
  const { offset, limit, page, pageSize } = parsePagination(pagination);

  const where = and(
    eq(files.orgId, orgId),
    eq(files.userId, userId),
    isNull(files.deletedAt),
  );

  const [data, countResult] = await Promise.all([
    db.select().from(files).where(where).offset(offset).limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(files).where(where),
  ]);

  return buildPaginatedResponse(data, countResult[0]?.count ?? 0, { offset, limit, page, pageSize });
}

export async function deleteFile(orgId: string, fileId: string) {
  const file = await getFile(orgId, fileId);
  if (!file) return null;

  await deleteObject(file.storagePath);

  const result = await db
    .update(files)
    .set({ deletedAt: new Date() })
    .where(eq(files.id, fileId))
    .returning();
  if (result[0]) syncFileDelete(fileId);
  return result[0] ?? null;
}

export async function getStorageUsage(orgId: string, userId: string) {
  const result = await db
    .select({ totalBytes: sql<number>`COALESCE(SUM(${files.sizeBytes}), 0)::bigint` })
    .from(files)
    .where(and(eq(files.orgId, orgId), eq(files.userId, userId), isNull(files.deletedAt)));
  return Number(result[0]?.totalBytes ?? 0);
}

export async function getOrgStorageUsage(orgId: string) {
  const result = await db
    .select({ totalBytes: sql<number>`COALESCE(SUM(${files.sizeBytes}), 0)::bigint` })
    .from(files)
    .where(and(eq(files.orgId, orgId), isNull(files.deletedAt)));
  return Number(result[0]?.totalBytes ?? 0);
}

const INGESTIBLE_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/html",
]);

function isIngestible(contentType: string): boolean {
  if (INGESTIBLE_TYPES.has(contentType)) return true;
  if (contentType.startsWith("text/")) return true;
  if (contentType.startsWith("image/")) return true;
  return false;
}

function triggerFileIngestion(file: { id: string; orgId: string; contentType: string }): void {
  if (!isIngestible(file.contentType)) return;
  getTemporalClient()
    .then((client) =>
      client.workflow.start("fileIngestionWorkflow", {
        taskQueue: TASK_QUEUES.INGESTION,
        workflowId: `file-ingest-${file.id}`,
        args: [{ fileId: file.id, orgId: file.orgId }],
      }),
    )
    .catch((err) => logger.error({ err }, "[file] Failed to start ingestion workflow"));
}
