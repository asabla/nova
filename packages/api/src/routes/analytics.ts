import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { analyticsService } from "../services/analytics.service";
import { requireRole } from "../middleware/rbac";

const analyticsRoutes = new Hono<AppContext>();

analyticsRoutes.get("/stats", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const from = c.req.query("from") ? new Date(c.req.query("from")!) : undefined;
  const to = c.req.query("to") ? new Date(c.req.query("to")!) : undefined;
  const stats = await analyticsService.getOrgStats(orgId, from, to);
  return c.json(stats);
});

analyticsRoutes.get("/usage", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const period = (c.req.query("period") as "day" | "week" | "month") ?? "day";
  const days = parseInt(c.req.query("days") ?? "30");
  const usage = await analyticsService.getUsageOverTime(orgId, period, days);
  return c.json({ data: usage });
});

analyticsRoutes.get("/models", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const models = await analyticsService.getTopModels(orgId);
  return c.json({ data: models });
});

export { analyticsRoutes };
