import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { searchService } from "../services/search.service";

const searchRoutes = new Hono<AppContext>();

const searchQuerySchema = z.object({
  q: z.string().min(2),
  type: z.enum(["all", "conversations", "messages", "agents", "knowledge", "files"]).optional(),
  mode: z.enum(["keyword", "semantic"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  workspaceId: z.string().uuid().optional(),
  model: z.string().optional(),
  participants: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// GET /api/search - keyword search
searchRoutes.get("/", zValidator("query", searchQuerySchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { q, type, mode, dateFrom, dateTo, workspaceId, model, participants, limit, offset } =
    c.req.valid("query");

  const participantIds = participants ? participants.split(",").filter(Boolean) : undefined;

  const results = await searchService.globalSearch(orgId, q, {
    limit: limit ?? 20,
    offset: offset ?? 0,
    type: type ?? "all",
    mode: mode ?? "keyword",
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    workspaceId,
    model,
    participantIds,
    userId,
  });
  return c.json(results);
});

// POST /api/search - semantic search (accepts body for embedding vector)
searchRoutes.post(
  "/",
  zValidator(
    "json",
    z.object({
      q: z.string().min(2),
      type: z.enum(["all", "conversations", "messages", "agents", "knowledge", "files"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      workspaceId: z.string().uuid().optional(),
      model: z.string().optional(),
      participants: z.array(z.string().uuid()).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      offset: z.number().int().min(0).optional(),
    }),
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");
    const { q, type, dateFrom, dateTo, workspaceId, model, participants, limit, offset } =
      c.req.valid("json");

    const results = await searchService.globalSearch(orgId, q, {
      limit: limit ?? 20,
      offset: offset ?? 0,
      type: type ?? "all",
      mode: "semantic",
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      workspaceId,
      model,
      participantIds: participants,
      userId,
    });
    return c.json(results);
  },
);

export { searchRoutes };
