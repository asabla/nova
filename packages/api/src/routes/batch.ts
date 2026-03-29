import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { chatCompletion } from "../lib/litellm";
import { writeAuditLog } from "../services/audit.service";
import { db } from "../lib/db";
import { dataJobs } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

const batchRoutes = new Hono<AppContext>();

const batchRequestSchema = z.object({
  requests: z.array(z.object({
    id: z.string().min(1),
    model: z.string().min(1),
    messages: z.array(z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })).min(1),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  })).min(1).max(50),
  webhookUrl: z.string().url().optional(),
});

// Synchronous batch - process all requests and return results
batchRoutes.post("/", zValidator("json", batchRequestSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { requests } = c.req.valid("json");

  const results = await Promise.allSettled(
    requests.map(async (req) => {
      const result = await chatCompletion({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        orgId,
      });

      return {
        id: req.id,
        status: "success" as const,
        result: {
          content: result.choices?.[0]?.message?.content ?? "",
          model: result.model,
          usage: result.usage,
        },
      };
    }),
  );

  const output = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      id: requests[i].id,
      status: "error" as const,
      error: r.reason?.message ?? "Unknown error",
    };
  });

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "batch.execute",
    resourceType: "batch",
    details: { requestCount: requests.length, successCount: output.filter((r) => r.status === "success").length },
  });

  return c.json({
    results: output,
    summary: {
      total: output.length,
      succeeded: output.filter((r) => r.status === "success").length,
      failed: output.filter((r) => r.status === "error").length,
    },
  });
});

// Async batch - create a job and process in background
batchRoutes.post("/async", zValidator("json", batchRequestSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { requests, webhookUrl } = c.req.valid("json");

  const [job] = await db.insert(dataJobs).values({
    orgId,
    userId,
    type: "batch_completions",
    status: "pending",
    metadata: { requests, webhookUrl, results: [] },
  }).returning();

  // Process in background (non-blocking)
  processBatchAsync(job.id, orgId, requests, webhookUrl).catch(console.error);

  return c.json({ batchId: job.id, status: "pending", requestCount: requests.length }, 202);
});

// Poll batch status
batchRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const [job] = await db.select().from(dataJobs)
    .where(and(eq(dataJobs.id, c.req.param("id")), eq(dataJobs.orgId, orgId)));

  if (!job) throw AppError.notFound("Batch job not found");

  const meta = job.metadata as any;
  return c.json({
    batchId: job.id,
    status: job.status,
    progress: job.progressPct,
    results: job.status === "completed" ? meta?.results : undefined,
    error: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

async function processBatchAsync(
  jobId: string,
  orgId: string,
  requests: z.infer<typeof batchRequestSchema>["requests"],
  webhookUrl?: string,
) {
  const results: any[] = [];
  const concurrency = 5;

  await db.update(dataJobs).set({ status: "processing", updatedAt: new Date() }).where(eq(dataJobs.id, jobId));

  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (req) => {
        const result = await chatCompletion({
          model: req.model,
          messages: req.messages,
          temperature: req.temperature,
          max_tokens: req.maxTokens,
          orgId,
        });
        return {
          id: req.id,
          status: "success" as const,
          result: {
            content: result.choices?.[0]?.message?.content ?? "",
            model: result.model,
            usage: result.usage,
          },
        };
      }),
    );

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      results.push(
        r.status === "fulfilled"
          ? r.value
          : { id: batch[j].id, status: "error", error: r.reason?.message ?? "Unknown error" },
      );
    }

    const progress = Math.round((results.length / requests.length) * 100);
    await db.update(dataJobs)
      .set({ progressPct: progress, metadata: { requests, webhookUrl, results }, updatedAt: new Date() })
      .where(eq(dataJobs.id, jobId));
  }

  await db.update(dataJobs)
    .set({ status: "completed", progressPct: 100, metadata: { requests, webhookUrl, results }, updatedAt: new Date() })
    .where(eq(dataJobs.id, jobId));

  // Deliver webhook if configured
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "batch.completed",
          batchId: jobId,
          summary: {
            total: results.length,
            succeeded: results.filter((r) => r.status === "success").length,
            failed: results.filter((r) => r.status === "error").length,
          },
          results,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Non-critical
    }
  }
}

export { batchRoutes };
