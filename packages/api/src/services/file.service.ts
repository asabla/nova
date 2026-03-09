import { db } from "../lib/db";
import { files } from "@nova/shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getUploadUrl, getDownloadUrl, deleteObject } from "../lib/minio";
import { parsePagination, buildPaginatedResponse, type PaginationInput } from "@nova/shared/utils";
import { env } from "../lib/env";

export async function presignUpload(orgId: string, userId: string, filename: string, contentType: string, sizeBytes: number) {
  const { url, key } = await getUploadUrl(orgId, filename);

  const result = await db.insert(files).values({
    orgId,
    userId,
    filename,
    contentType,
    sizeBytes,
    storagePath: key,
    storageBucket: env.MINIO_BUCKET,
  }).returning();

  return { uploadUrl: url, fileId: result[0].id, key };
}

export async function createFileRecord(orgId: string, userId: string, filename: string, contentType: string, sizeBytes: number, storagePath: string) {
  const result = await db.insert(files).values({
    orgId,
    userId,
    filename,
    contentType,
    sizeBytes,
    storagePath,
    storageBucket: env.MINIO_BUCKET,
  }).returning();
  return result[0];
}

export async function confirmUpload(orgId: string, fileId: string) {
  const result = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.orgId, orgId), isNull(files.deletedAt)));
  return result[0] ?? null;
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
  const url = await getDownloadUrl(file.storagePath);
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
