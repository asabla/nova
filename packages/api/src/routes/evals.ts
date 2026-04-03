import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../lib/validator";
import { TASK_QUEUES } from "@nova/shared/constants";
import type { AppContext } from "../types/context";
import { AppError } from "@nova/shared/utils";
import { getTemporalClient } from "../lib/temporal";
import * as evalService from "../services/eval.service";

const evalRoutes = new Hono<AppContext>();

// ---------------------------------------------------------------------------
// Dashboard & Trends
// ---------------------------------------------------------------------------

evalRoutes.get("/dashboard", async (c) => {
  const orgId = c.get("orgId");
  const data = await evalService.getDashboard(orgId);
  return c.json(data);
});

evalRoutes.get("/trends", zValidator("query", z.object({
  period: z.enum(["7d", "30d", "90d"]).default("7d"),
})), async (c) => {
  const orgId = c.get("orgId");
  const { period } = c.req.valid("query");
  const data = await evalService.getTrends(orgId, period);
  return c.json(data);
});

// ---------------------------------------------------------------------------
// Eval Runs
// ---------------------------------------------------------------------------

evalRoutes.get("/runs", zValidator("query", z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  evalType: z.enum(["chat", "planning", "research"]).optional(),
})), async (c) => {
  const orgId = c.get("orgId");
  const { page, pageSize, evalType } = c.req.valid("query");
  const data = await evalService.listEvalRuns(orgId, { page, pageSize }, evalType);
  return c.json(data);
});

evalRoutes.get("/runs/:id", async (c) => {
  const orgId = c.get("orgId");
  const run = await evalService.getEvalRun(orgId, c.req.param("id"));
  if (!run) throw AppError.notFound("Eval run not found");
  return c.json(run);
});

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

evalRoutes.get("/dimensions", async (c) => {
  const orgId = c.get("orgId");
  const data = await evalService.listDimensions(orgId);
  return c.json(data);
});

evalRoutes.put("/dimensions/:id", zValidator("json", z.object({
  weight: z.string().regex(/^\d\.\d{1,2}$/).optional(),
  isEnabled: z.boolean().optional(),
})), async (c) => {
  const orgId = c.get("orgId");
  const body = c.req.valid("json");
  const result = await evalService.updateDimension(orgId, c.req.param("id"), body);
  if (!result) throw AppError.notFound("Dimension not found");
  return c.json(result);
});

// ---------------------------------------------------------------------------
// System Prompts & Versions
// ---------------------------------------------------------------------------

evalRoutes.get("/prompts", async (c) => {
  const orgId = c.get("orgId");
  const data = await evalService.listSystemPrompts(orgId);
  return c.json(data);
});

evalRoutes.get("/prompts/:slug/versions", async (c) => {
  const orgId = c.get("orgId");
  const data = await evalService.listPromptVersions(orgId, c.req.param("slug"));
  return c.json(data);
});

evalRoutes.post("/prompts/:slug/versions/:id/approve", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const result = await evalService.approvePromptVersion(orgId, c.req.param("slug"), c.req.param("id"), userId);
  if (!result) throw AppError.notFound("Version not found");
  return c.json(result);
});

evalRoutes.post("/prompts/:slug/versions/:id/reject", async (c) => {
  const orgId = c.get("orgId");
  const result = await evalService.rejectPromptVersion(orgId, c.req.param("id"));
  if (!result) throw AppError.notFound("Version not found");
  return c.json(result);
});

evalRoutes.post("/prompts/:slug/versions/:id/deploy", async (c) => {
  const orgId = c.get("orgId");
  const result = await evalService.deployPromptVersion(orgId, c.req.param("slug"), c.req.param("id"));
  if (!result) throw AppError.notFound("Prompt or version not found");
  return c.json(result);
});

evalRoutes.patch("/prompts/:slug/versions/:id/traffic", zValidator("json", z.object({
  trafficPct: z.number().int().min(0).max(100),
})), async (c) => {
  const orgId = c.get("orgId");
  const { trafficPct } = c.req.valid("json");
  const result = await evalService.updatePromptVersionTraffic(orgId, c.req.param("id"), trafficPct);
  if (!result) throw AppError.notFound("Version not found");
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Optimizations
// ---------------------------------------------------------------------------

evalRoutes.get("/optimizations", async (c) => {
  const orgId = c.get("orgId");
  const data = await evalService.listOptimizations(orgId);
  return c.json(data);
});

evalRoutes.post("/optimizations", zValidator("json", z.object({
  slug: z.string().min(1),
})), async (c) => {
  const orgId = c.get("orgId");
  const { slug } = c.req.valid("json");

  const client = await getTemporalClient();
  const handle = await client.workflow.start("promptOptimizationWorkflow", {
    taskQueue: TASK_QUEUES.BACKGROUND,
    workflowId: `prompt-opt-manual-${orgId}-${slug}-${Date.now()}`,
    args: [{
      orgId,
      slug,
      triggerReason: "manual",
      triggerData: { triggeredBy: c.get("userId") },
    }],
  });

  return c.json({ workflowId: handle.workflowId, status: "started" });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

evalRoutes.get("/settings", async (c) => {
  const orgId = c.get("orgId");
  const data = await evalService.getEvalSettings(orgId);
  return c.json(data);
});

evalRoutes.put("/settings", zValidator("json", z.record(z.string(), z.string())), async (c) => {
  const orgId = c.get("orgId");
  const body = c.req.valid("json");
  await evalService.updateEvalSettings(orgId, body);
  const updated = await evalService.getEvalSettings(orgId);
  return c.json(updated);
});

export default evalRoutes;
