import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { promptService } from "../services/prompt.service";
import { parsePagination } from "@nova/shared/utils";

const promptRoutes = new Hono<AppContext>();

promptRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const { limit, offset } = parsePagination(c.req.query());
  const search = c.req.query("search");
  const result = await promptService.list(orgId, { search, limit, offset });
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
});

promptRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = createPromptSchema.parse(await c.req.json());
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

export { promptRoutes };
