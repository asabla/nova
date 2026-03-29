import { Hono } from "hono";
import { sql, desc, isNull, gte, eq, and, asc } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { organisations, users, conversations, messages, usageStats } from "@nova/shared/schemas";

const adminStatsRoutes = new Hono<AppContext>();

// Platform-wide statistics
adminStatsRoutes.get("/", async (c) => {
  const [stats] = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM organisations WHERE deleted_at IS NULL) as org_count,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL) as user_count,
      (SELECT count(*) FROM conversations WHERE deleted_at IS NULL) as conversation_count,
      (SELECT count(*) FROM messages WHERE deleted_at IS NULL) as message_count,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL AND updated_at >= now() - interval '7 days') as active_users_7d,
      (SELECT count(*) FROM organisations WHERE deleted_at IS NULL AND created_at >= now() - interval '30 days') as new_orgs_30d
  `);

  return c.json(stats);
});

// Cross-org usage for billing
adminStatsRoutes.get("/usage", async (c) => {
  const since = c.req.query("since");
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const usage = await db
    .select({
      orgId: organisations.id,
      orgName: organisations.name,
      billingPlan: organisations.billingPlan,
      memberCount: sql<number>`(
        SELECT count(*) FROM user_profiles
        WHERE org_id = ${organisations.id} AND deleted_at IS NULL
      )`.mapWith(Number),
      conversationCount: sql<number>`(
        SELECT count(*) FROM conversations
        WHERE org_id = ${organisations.id} AND created_at >= ${sinceDate}
      )`.mapWith(Number),
      messageCount: sql<number>`(
        SELECT count(*) FROM messages
        WHERE org_id = ${organisations.id} AND created_at >= ${sinceDate}
      )`.mapWith(Number),
      totalTokens: sql<number>`(
        SELECT coalesce(sum(coalesce(token_count_prompt,0) + coalesce(token_count_completion,0)), 0)
        FROM messages
        WHERE org_id = ${organisations.id}
          AND sender_type = 'assistant'
          AND created_at >= ${sinceDate}
      )`.mapWith(Number),
    })
    .from(organisations)
    .where(isNull(organisations.deletedAt))
    .orderBy(desc(sql`"messageCount"`));

  return c.json({ since: sinceDate.toISOString(), data: usage });
});

// Platform metrics time-series (from usageStats collected by background worker)
adminStatsRoutes.get("/daily", async (c) => {
  const days = Math.min(Number(c.req.query("days") ?? 30), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Find system org (platform metrics are stored under it)
  const [systemOrg] = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isSystemOrg, true));

  if (!systemOrg) {
    return c.json({ data: [], message: "No system org found — run metrics collection first" });
  }

  const result = await db
    .select({
      date: usageStats.periodStart,
      orgCount: usageStats.promptTokens,        // convention: promptTokens = org_count
      userCount: usageStats.completionTokens,    // convention: completionTokens = user_count
      tokens: usageStats.totalTokens,
      messages: usageStats.requestCount,
      conversations: usageStats.storageBytes,    // convention: storageBytes = conversation_count
    })
    .from(usageStats)
    .where(and(
      eq(usageStats.orgId, systemOrg.id),
      eq(usageStats.period, "day"),
      isNull(usageStats.userId),
      isNull(usageStats.modelId),
      gte(usageStats.periodStart, since),
    ))
    .orderBy(asc(usageStats.periodStart));

  return c.json({ data: result });
});

// Trigger backfill (admin action)
adminStatsRoutes.post("/backfill", async (c) => {
  const { days } = await c.req.json().catch(() => ({ days: 90 }));

  // Import and call the Temporal client to start the backfill workflow
  try {
    const { getTemporalClient } = await import("../../lib/temporal");
    const client = await getTemporalClient();
    const handle = await client.workflow.start("backfillMetricsWorkflow", {
      taskQueue: "nova-background",
      workflowId: `backfill-metrics-${Date.now()}`,
      args: [{ days: Math.min(days, 365) }],
    });

    return c.json({ ok: true, workflowId: handle.workflowId, days });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

export { adminStatsRoutes };
