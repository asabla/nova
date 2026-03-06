import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { searchService } from "../services/search.service";

const searchRoutes = new Hono<AppContext>();

const searchQuerySchema = z.object({
  q: z.string().min(2),
  type: z.enum(["all", "conversations", "messages", "agents", "knowledge", "files"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  workspaceId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

searchRoutes.get("/", zValidator("query", searchQuerySchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { q, type, dateFrom, dateTo, workspaceId, limit } = c.req.valid("query");

  const results = await searchService.globalSearch(orgId, q, {
    limit: limit ?? 10,
    type: type ?? "all",
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    workspaceId,
    userId,
  });
  return c.json(results);
});

export { searchRoutes };
