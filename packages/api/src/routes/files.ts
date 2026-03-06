import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import * as fileService from "../services/file.service";
import { AppError } from "@nova/shared/utils";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@nova/shared/constants";
import { requireRole } from "../middleware/rbac";
import { db } from "../lib/db";
import { files } from "@nova/shared/schemas";
import { orgSettings } from "@nova/shared/schemas";
import { eq, and, isNull, sql, desc, ilike } from "drizzle-orm";

const fileRoutes = new Hono<AppContext>();

const presignSchema = z.object({
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

fileRoutes.post("/presign", zValidator("json", presignSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { filename, contentType, size } = c.req.valid("json");

  const result = await fileService.presignUpload(orgId, userId, filename, contentType, size);
  return c.json(result, 201);
});

fileRoutes.post("/:fileId/confirm", async (c) => {
  const orgId = c.get("orgId");
  const file = await fileService.confirmUpload(orgId, c.req.param("fileId"));
  if (!file) throw AppError.notFound("File");
  return c.json(file);
});

fileRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const page = Number(c.req.query("page") ?? 1);
  const pageSize = Number(c.req.query("pageSize") ?? 20);
  const result = await fileService.listFiles(orgId, userId, { page, pageSize });
  return c.json(result);
});

fileRoutes.get("/:fileId", async (c) => {
  const orgId = c.get("orgId");
  const file = await fileService.getFile(orgId, c.req.param("fileId"));
  if (!file) throw AppError.notFound("File");
  return c.json(file);
});

fileRoutes.get("/:fileId/download", async (c) => {
  const orgId = c.get("orgId");
  const result = await fileService.getFileDownloadUrl(orgId, c.req.param("fileId"));
  if (!result) throw AppError.notFound("File");
  return c.json({ url: result.url });
});

fileRoutes.delete("/:fileId", async (c) => {
  const orgId = c.get("orgId");
  const file = await fileService.deleteFile(orgId, c.req.param("fileId"));
  if (!file) throw AppError.notFound("File");
  return c.json({ ok: true });
});

// GET /usage - Get total storage usage for the authenticated user
fileRoutes.get("/usage/me", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const totalBytes = await fileService.getStorageUsage(orgId, userId);
  return c.json({ totalBytes, totalMb: Math.round(totalBytes / 1024 / 1024) });
});

// GET /admin - Admin: list all files across the org with filters
fileRoutes.get("/admin/list", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const page = Number(c.req.query("page") ?? 1);
  const pageSize = Math.min(Number(c.req.query("pageSize") ?? 50), 100);
  const offset = (page - 1) * pageSize;
  const contentType = c.req.query("contentType");
  const search = c.req.query("search");
  const userId = c.req.query("userId");

  const conditions = [eq(files.orgId, orgId), isNull(files.deletedAt)];
  if (contentType) {
    conditions.push(eq(files.contentType, contentType));
  }
  if (search) {
    conditions.push(ilike(files.filename, `%${search}%`));
  }
  if (userId) {
    conditions.push(eq(files.userId, userId));
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db.select().from(files).where(where).orderBy(desc(files.createdAt)).offset(offset).limit(pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(files).where(where),
  ]);

  return c.json({
    data,
    total: countResult[0]?.count ?? 0,
    page,
    pageSize,
  });
});

// DELETE /admin/:id - Admin: delete any file in the org
fileRoutes.delete("/admin/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const fileId = c.req.param("id");

  const file = await fileService.deleteFile(orgId, fileId);
  if (!file) throw AppError.notFound("File");
  return c.json({ ok: true });
});

// GET /config - Get file upload config (allowed types, max sizes)
fileRoutes.get("/config/upload", async (c) => {
  const orgId = c.get("orgId");

  // Load org-level overrides from orgSettings
  const settings = await db
    .select()
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, "file_upload_config")));

  const orgConfig = settings[0] ? JSON.parse(settings[0].value) : null;

  return c.json({
    allowedMimeTypes: orgConfig?.allowedMimeTypes ?? ALLOWED_MIME_TYPES,
    maxFileSizeBytes: orgConfig?.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES,
    maxFileSizeMb: Math.round((orgConfig?.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES) / 1024 / 1024),
  });
});

// PATCH /config - Admin: set allowed file types and max file sizes
const fileConfigSchema = z.object({
  allowedMimeTypes: z.array(z.string().min(1)).optional(),
  maxFileSizeBytes: z.number().int().positive().optional(),
});

fileRoutes.patch("/config/upload", requireRole("org-admin"), zValidator("json", fileConfigSchema), async (c) => {
  const orgId = c.get("orgId");
  const data = c.req.valid("json");

  const configValue = JSON.stringify({
    allowedMimeTypes: data.allowedMimeTypes ?? ALLOWED_MIME_TYPES,
    maxFileSizeBytes: data.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES,
  });

  await db
    .insert(orgSettings)
    .values({ orgId, key: "file_upload_config", value: configValue })
    .onConflictDoUpdate({
      target: [orgSettings.orgId, orgSettings.key],
      set: { value: configValue, updatedAt: new Date() },
    });

  return c.json({ ok: true });
});

export { fileRoutes };
