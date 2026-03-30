import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { workflows } from "@nova/shared/schemas";
import { getTemporalClient } from "../lib/temporal";
import { AppError } from "@nova/shared/utils";
import { logger } from "../lib/logger";

const workflowRoutes = new Hono<AppContext>();

// GET / — List workflows for the org
workflowRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const status = c.req.query("status");
  const type = c.req.query("type");
  const limitParam = c.req.query("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "20", 10) || 20, 1), 100);

  const conditions = [eq(workflows.orgId, orgId)];
  if (status) conditions.push(eq(workflows.status, status));
  if (type) conditions.push(eq(workflows.type, type));

  const result = await db
    .select()
    .from(workflows)
    .where(and(...conditions))
    .orderBy(desc(workflows.startedAt))
    .limit(limit);

  return c.json({ data: result });
});

// GET /:id — Get workflow detail
workflowRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, c.req.param("id")), eq(workflows.orgId, orgId)));

  if (!workflow) throw AppError.notFound("Workflow not found");

  // If still running, try to get live status from Temporal
  if (workflow.status === "running") {
    try {
      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(workflow.temporalWorkflowId);
      const description = await handle.describe();
      return c.json({
        ...workflow,
        temporal: {
          status: description.status.name,
          runId: description.runId,
          startTime: description.startTime,
          closeTime: description.closeTime,
          historyLength: description.historyLength,
        },
      });
    } catch (err) {
      logger.warn({ workflowId: workflow.id, error: err }, "Failed to fetch Temporal status");
    }
  }

  return c.json(workflow);
});

// POST /:id/cancel — Cancel a running workflow
workflowRoutes.post("/:id/cancel", async (c) => {
  const orgId = c.get("orgId");
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, c.req.param("id")), eq(workflows.orgId, orgId)));

  if (!workflow) throw AppError.notFound("Workflow not found");
  if (workflow.status !== "running") {
    throw AppError.badRequest("Only running workflows can be cancelled");
  }

  // Cancel via Temporal
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflow.temporalWorkflowId);
    await handle.cancel();
  } catch (err) {
    logger.error({ workflowId: workflow.id, error: err }, "Failed to cancel Temporal workflow");
    throw AppError.badRequest("Failed to cancel workflow via Temporal");
  }

  // Update DB status
  const [updated] = await db
    .update(workflows)
    .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(workflows.id, workflow.id))
    .returning();

  return c.json(updated);
});

export { workflowRoutes };
