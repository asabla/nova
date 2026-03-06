import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import * as fileService from "../services/file.service";
import { AppError } from "@nova/shared/utils";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@nova/shared/constants";

const files = new Hono<AppContext>();

const presignSchema = z.object({
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

files.post("/presign", zValidator("json", presignSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { filename, contentType, size } = c.req.valid("json");

  const result = await fileService.presignUpload(orgId, userId, filename, contentType, size);
  return c.json(result, 201);
});

files.post("/:fileId/confirm", async (c) => {
  const orgId = c.get("orgId");
  const file = await fileService.confirmUpload(orgId, c.req.param("fileId"));
  if (!file) throw AppError.notFound("File");
  return c.json(file);
});

files.get("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const page = Number(c.req.query("page") ?? 1);
  const pageSize = Number(c.req.query("pageSize") ?? 20);
  const result = await fileService.listFiles(orgId, userId, { page, pageSize });
  return c.json(result);
});

files.get("/:fileId", async (c) => {
  const orgId = c.get("orgId");
  const file = await fileService.getFile(orgId, c.req.param("fileId"));
  if (!file) throw AppError.notFound("File");
  return c.json(file);
});

files.get("/:fileId/download", async (c) => {
  const orgId = c.get("orgId");
  const result = await fileService.getFileDownloadUrl(orgId, c.req.param("fileId"));
  if (!result) throw AppError.notFound("File");
  return c.json({ url: result.url });
});

files.delete("/:fileId", async (c) => {
  const orgId = c.get("orgId");
  const file = await fileService.deleteFile(orgId, c.req.param("fileId"));
  if (!file) throw AppError.notFound("File");
  return c.json({ ok: true });
});

files.get("/usage/me", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const totalBytes = await fileService.getStorageUsage(orgId, userId);
  return c.json({ totalBytes, totalMb: Math.round(totalBytes / 1024 / 1024) });
});

export { files as fileRoutes };
