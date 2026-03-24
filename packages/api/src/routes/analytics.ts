import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { analyticsService } from "../services/analytics.service";
import { requireRole } from "../middleware/rbac";

const analyticsRoutes = new Hono<AppContext>();

// ── Helper: parse date range from query params ─────────────────────
function parseDateRange(c: any) {
  const from = c.req.query("from") ? new Date(c.req.query("from")!) : undefined;
  let to = c.req.query("to") ? new Date(c.req.query("to")!) : undefined;
  // When "to" is a date-only string (e.g. "2026-03-24"), it parses as midnight UTC.
  // Extend to end of day so records from that day are included.
  if (to && c.req.query("to")!.length === 10) {
    to.setUTCHours(23, 59, 59, 999);
  }
  return { from, to };
}

// ── Legacy endpoints (preserved) ───────────────────────────────────

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

// ── New endpoints ──────────────────────────────────────────────────

// GET /api/analytics/summary - Org-level summary
analyticsRoutes.get("/summary", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const range = parseDateRange(c);
  const summary = await analyticsService.getOrgSummary(orgId, range);
  return c.json({ data: summary });
});

// GET /api/analytics/daily - Daily breakdown (last N days)
analyticsRoutes.get("/daily", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const days = parseInt(c.req.query("days") ?? "30");
  const daily = await analyticsService.getDailyStats(orgId, days);
  return c.json({ data: daily });
});

// GET /api/analytics/by-model - Usage breakdown by model
analyticsRoutes.get("/by-model", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const range = parseDateRange(c);
  const breakdown = await analyticsService.getModelBreakdown(orgId, range);
  return c.json({ data: breakdown });
});

// GET /api/analytics/by-user - Usage per user (admin only)
analyticsRoutes.get("/by-user", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const range = parseDateRange(c);
  const breakdown = await analyticsService.getUserBreakdown(orgId, range);
  return c.json({ data: breakdown });
});

// GET /api/analytics/by-group - Usage per group (admin only)
analyticsRoutes.get("/by-group", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const range = parseDateRange(c);
  const breakdown = await analyticsService.getGroupBreakdown(orgId, range);
  return c.json({ data: breakdown });
});

// GET /api/analytics/costs - Cost breakdown with budget tracking
analyticsRoutes.get("/costs", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const range = parseDateRange(c);
  const costs = await analyticsService.getCostBreakdown(orgId, range);
  return c.json({ data: costs });
});

// GET /api/analytics/trends - Trend analysis (weekly/monthly comparison)
analyticsRoutes.get("/trends", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const range = parseDateRange(c);
  const trends = await analyticsService.getTrends(orgId, range);
  return c.json({ data: trends });
});

// POST /api/analytics/export - Export analytics as CSV
analyticsRoutes.post("/export", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = await c.req.json();
  const type = (body.type as "daily" | "by-model" | "by-user") ?? "daily";
  const range = {
    from: body.from ? new Date(body.from) : undefined,
    to: body.to ? new Date(body.to) : undefined,
  };

  const csv = await analyticsService.exportCsv(orgId, type, range);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="nova-analytics-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

// GET /api/analytics/me - Personal usage for logged-in user
analyticsRoutes.get("/me", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const range = parseDateRange(c);
  const personal = await analyticsService.getPersonalUsage(orgId, userId, range);
  return c.json(personal);
});

// ── Budget Alerts ──────────────────────────────────────────────────

const budgetAlertSchema = z.object({
  name: z.string().min(1).max(200),
  scope: z.enum(["org", "group", "user"]),
  scopeId: z.string().uuid().optional(),
  thresholdType: z.enum(["cost_cents", "tokens"]),
  thresholdValue: z.number().positive(),
  period: z.enum(["daily", "weekly", "monthly"]),
  notifyEmail: z.boolean().default(true),
  notifyWebhook: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
  isEnabled: z.boolean().default(true),
});

analyticsRoutes.get("/budget-alerts", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const alerts = await analyticsService.getBudgetAlerts(orgId);
  return c.json({ data: alerts });
});

analyticsRoutes.post("/budget-alerts", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = budgetAlertSchema.parse(await c.req.json());
  const alert = await analyticsService.createBudgetAlert(orgId, body);
  return c.json(alert, 201);
});

analyticsRoutes.patch("/budget-alerts/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = budgetAlertSchema.partial().parse(await c.req.json());
  const alert = await analyticsService.updateBudgetAlert(orgId, c.req.param("id"), body);
  return c.json(alert);
});

analyticsRoutes.delete("/budget-alerts/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  await analyticsService.deleteBudgetAlert(orgId, c.req.param("id"));
  return c.body(null, 204);
});

// GET /api/analytics/budget-status - Check current spend vs budgets
analyticsRoutes.get("/budget-status", async (c) => {
  const orgId = c.get("orgId");
  const status = await analyticsService.getBudgetStatus(orgId);
  return c.json({ data: status });
});

// GET /api/analytics/traces - Agent execution traces
analyticsRoutes.get("/traces", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const range = parseDateRange(c);
  const limit = parseInt(c.req.query("limit") ?? "50");
  const filters = {
    status: c.req.query("status") || undefined,
    tier: c.req.query("tier") || undefined,
    agentId: c.req.query("agentId") || undefined,
    search: c.req.query("search") || undefined,
    cursor: c.req.query("cursor") || undefined,
  };
  const result = await analyticsService.getAgentTraces(orgId, range, limit, filters);
  return c.json(result);
});

export { analyticsRoutes };
