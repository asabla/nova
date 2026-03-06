import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { searchService } from "../services/search.service";

const searchRoutes = new Hono<AppContext>();

searchRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const query = c.req.query("q");

  if (!query || query.length < 2) {
    return c.json({ conversations: [], messages: [], agents: [], knowledge: [] });
  }

  const results = await searchService.globalSearch(orgId, query, { limit: 10 });
  return c.json(results);
});

export { searchRoutes };
