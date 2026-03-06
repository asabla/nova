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

// Export research report
researchRoutes.get("/:id/export", async (c) => {
  const orgId = c.get("orgId");
  const format = c.req.query("format") ?? "markdown";
  const [report] = await db.select().from(researchReports)
    .where(and(eq(researchReports.id, c.req.param("id")), eq(researchReports.orgId, orgId)));

  if (!report) throw AppError.notFound("Research report not found");

  if (format === "json") {
    c.header("Content-Disposition", `attachment; filename="research-${report.id}.json"`);
    return c.json(report);
  }

  // Markdown format
  const md = [
    `# ${report.query}`,
    "",
    `*Generated: ${new Date(report.createdAt).toISOString()}*`,
    "",
    report.report ?? "*No report content available*",
    "",
    "## Sources",
    "",
    ...((report.sources as any[]) ?? []).map((s: any, i: number) =>
      `${i + 1}. [${s.title ?? s.url}](${s.url})${s.summary ? ` - ${s.summary}` : ""}`
    ),
  ].join("\n");

  c.header("Content-Type", "text/markdown");
  c.header("Content-Disposition", `attachment; filename="research-${report.id}.md"`);
  return c.body(md);
});

// Re-run research with different parameters
researchRoutes.post("/:id/rerun", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const [originalReport] = await db.select().from(researchReports)
    .where(and(eq(researchReports.id, c.req.param("id")), eq(researchReports.orgId, orgId)));

  if (!originalReport) throw AppError.notFound("Research report not found");

  const body = z.object({
    maxSources: z.number().int().min(1).max(50).optional(),
    maxIterations: z.number().int().min(1).max(10).optional(),
  }).parse(await c.req.json());

  const config = (originalReport.config as Record<string, number>) ?? {};
  const workflowId = crypto.randomUUID();
  const [newReport] = await db.insert(researchReports).values({
    orgId,
    conversationId: originalReport.conversationId,
    userId,
    workflowId,
    query: originalReport.query,
    status: "pending",
    config: {
      maxSources: body.maxSources ?? config.maxSources ?? 10,
      maxIterations: body.maxIterations ?? config.maxIterations ?? 3,
    },
  }).returning();

  try {
    const client = await getTemporalClient();
    await client.workflow.start("deepResearchWorkflow", {
      taskQueue: "nova-main",
      workflowId: `research-${newReport.id}`,
      args: [{
        orgId,
        conversationId: originalReport.conversationId,
        reportId: newReport.id,
        query: originalReport.query,
        maxSources: body.maxSources ?? config.maxSources ?? 10,
        maxIterations: body.maxIterations ?? config.maxIterations ?? 3,
      }],
    });
  } catch {
    await db.update(researchReports).set({ status: "failed" }).where(eq(researchReports.id, newReport.id));
  }

  return c.json(newReport, 201);
});

export { researchRoutes };
