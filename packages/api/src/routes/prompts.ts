import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../lib/validator";
import type { AppContext } from "../types/context";
import { promptService } from "../services/prompt.service";
import { parsePagination } from "@nova/shared/utils";

const promptRoutes = new Hono<AppContext>();

// --- Basic CRUD ---

promptRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const { limit, offset } = parsePagination(c.req.query());
  const search = c.req.query("search");
  const category = c.req.query("category");
  const result = await promptService.list(orgId, { search, category, limit, offset });
  return c.json(result);
});

promptRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const prompt = await promptService.get(orgId, c.req.param("id"));
  return c.json(prompt);
});

const createPromptSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  content: z.string().min(1).max(100_000),
  category: z.string().max(100).optional(),
  variables: z.any().optional(),
  systemPrompt: z.string().max(100_000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  visibility: z.enum(["private", "team", "org"]).optional(),
});

promptRoutes.post("/", zValidator("json", createPromptSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const prompt = await promptService.create(orgId, userId, body);
  return c.json(prompt, 201);
});

promptRoutes.patch("/:id", async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    content: z.string().max(100_000).optional(),
    category: z.string().max(100).optional(),
  }).parse(await c.req.json());
  const prompt = await promptService.update(orgId, c.req.param("id"), body);
  return c.json(prompt);
});

promptRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  await promptService.delete(orgId, c.req.param("id"));
  return c.body(null, 204);
});

// --- Versioning (User Story #183) ---

const createVersionSchema = z.object({
  content: z.string().min(1).max(100_000),
  variables: z.any().optional(),
  systemPrompt: z.string().max(100_000).optional(),
  changelog: z.string().max(2000).optional(),
});

promptRoutes.post("/:id/versions", zValidator("json", createVersionSchema), async (c) => {
  const orgId = c.get("orgId");
  const promptId = c.req.param("id");
  const body = c.req.valid("json");
  const version = await promptService.createVersion(orgId, promptId, body);
  return c.json(version, 201);
});

promptRoutes.get("/:id/versions", async (c) => {
  const orgId = c.get("orgId");
  const promptId = c.req.param("id");
  const versions = await promptService.listVersions(orgId, promptId);
  return c.json(versions);
});

promptRoutes.get("/:id/versions/:version", async (c) => {
  const orgId = c.get("orgId");
  const promptId = c.req.param("id");
  const version = parseInt(c.req.param("version"), 10);
  if (isNaN(version) || version < 1) {
    return c.json({ error: "Invalid version number" }, 400);
  }
  const entry = await promptService.getVersion(orgId, promptId, version);
  return c.json(entry);
});

// --- Forking (User Story #184) ---

promptRoutes.post("/:id/fork", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const promptId = c.req.param("id");
  const forked = await promptService.fork(orgId, userId, promptId);
  return c.json(forked, 201);
});

// --- Rating (User Story #186) ---

const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

promptRoutes.post("/:id/rate", zValidator("json", rateSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const promptId = c.req.param("id");
  const { rating } = c.req.valid("json");
  const updated = await promptService.rate(orgId, promptId, userId, rating);
  return c.json(updated);
});

// --- Tags (User Story #185) ---

const updateTagsSchema = z.object({
  tags: z.array(z.string().max(50)).max(20),
});

promptRoutes.patch("/:id/tags", zValidator("json", updateTagsSchema), async (c) => {
  const orgId = c.get("orgId");
  const promptId = c.req.param("id");
  const { tags } = c.req.valid("json");
  const updated = await promptService.updateTags(orgId, promptId, tags);
  return c.json(updated);
});

// --- Visibility ---

const updateVisibilitySchema = z.object({
  visibility: z.enum(["private", "team", "org"]),
});

promptRoutes.patch("/:id/visibility", zValidator("json", updateVisibilitySchema), async (c) => {
  const orgId = c.get("orgId");
  const promptId = c.req.param("id");
  const { visibility } = c.req.valid("json");
  const updated = await promptService.updateVisibility(orgId, promptId, visibility);
  return c.json(updated);
});

export { promptRoutes };
