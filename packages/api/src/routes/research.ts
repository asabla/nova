import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { researchReports } from "@nova/shared/schemas";
import { getTemporalClient } from "../lib/temporal";
import { AppError } from "@nova/shared/utils";

const researchRoutes = new Hono<AppContext>();

researchRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(researchReports)
    .where(eq(researchReports.orgId, orgId))
    .orderBy(desc(researchReports.createdAt))
    .limit(50);

  return c.json({ data: result });
});

researchRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const [report] = await db.select().from(researchReports)
    .where(and(eq(researchReports.id, c.req.param("id")), eq(researchReports.orgId, orgId)));

  if (!report) throw AppError.notFound("Research report not found");
  return c.json(report);
});

const startResearchSchema = z.object({
  query: z.string().min(3).max(2000),
  conversationId: z.string().uuid().optional(),
  maxSources: z.number().int().min(1).max(50).optional().default(10),
  maxIterations: z.number().int().min(1).max(10).optional().default(3),
});

researchRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = startResearchSchema.parse(await c.req.json());

  const workflowId = crypto.randomUUID();
  const [report] = await db.insert(researchReports).values({
    orgId,
    conversationId: body.conversationId ?? crypto.randomUUID(),
    userId,
    workflowId,
    query: body.query,
    status: "pending",
    config: { maxSources: body.maxSources, maxIterations: body.maxIterations },
  }).returning();

  // Start Temporal workflow
  try {
    const client = await getTemporalClient();
    await client.workflow.start("deepResearchWorkflow", {
      taskQueue: "nova-main",
      workflowId: `research-${report.id}`,
      args: [{
        orgId,
        conversationId: body.conversationId,
        reportId: report.id,
        query: body.query,
        maxSources: body.maxSources,
        maxIterations: body.maxIterations,
      }],
    });
  } catch {
    // If Temporal is unavailable, mark as failed
    await db.update(researchReports).set({ status: "failed" }).where(eq(researchReports.id, report.id));
  }

  return c.json(report, 201);
});

export { researchRoutes };
