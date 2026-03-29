import { Hono } from "hono";
import { sql, desc, isNull, gte } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { organisations, users, conversations, messages } from "@nova/shared/schemas";

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
        SELECT coalesce(sum((metadata->>'totalTokens')::int), 0)
        FROM messages
        WHERE org_id = ${organisations.id}
          AND sender_type = 'assistant'
          AND created_at >= ${sinceDate}
          AND metadata->>'totalTokens' IS NOT NULL
      )`.mapWith(Number),
    })
    .from(organisations)
    .where(isNull(organisations.deletedAt))
    .orderBy(desc(sql`"messageCount"`));

  return c.json({ since: sinceDate.toISOString(), data: usage });
});

export { adminStatsRoutes };
