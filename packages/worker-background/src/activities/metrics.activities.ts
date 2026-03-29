/**
 * Platform metrics collection activities.
 * Aggregates cross-org statistics and stores in usageStats for historical tracking.
 */

import { db } from "@nova/worker-shared/db";
import { usageStats, organisations } from "@nova/shared/schemas";
import { eq, sql, and } from "drizzle-orm";

/**
 * Collect platform-wide metrics and store as daily snapshots.
 * Uses the system org as the "platform" scope in usageStats.
 */
export async function collectPlatformMetrics(): Promise<{ snapshotsCreated: number }> {
  // Find the system org to use as platform scope
  const [systemOrg] = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isSystemOrg, true));

  if (!systemOrg) {
    console.warn("[metrics] No system org found — skipping platform metrics collection");
    return { snapshotsCreated: 0 };
  }

  const platformOrgId = systemOrg.id;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStartISO = todayStart.toISOString();

  // Aggregate current platform stats
  const [stats] = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM organisations WHERE deleted_at IS NULL) as org_count,
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) as user_count,
      (SELECT count(*)::int FROM conversations WHERE deleted_at IS NULL) as conversation_count,
      (SELECT count(*)::int FROM messages WHERE deleted_at IS NULL) as message_count,
      (SELECT coalesce(sum((metadata->>'totalTokens')::bigint), 0) FROM messages WHERE sender_type = 'assistant' AND metadata->>'totalTokens' IS NOT NULL AND created_at >= ${todayStartISO}::timestamptz) as today_tokens,
      (SELECT count(*)::int FROM messages WHERE created_at >= ${todayStartISO}::timestamptz) as today_requests
  `) as any[];

  if (!stats) return { snapshotsCreated: 0 };

  // Upsert daily platform snapshot
  // We store org/user/conversation counts in the token fields as a convention:
  //   promptTokens = org_count, completionTokens = user_count,
  //   totalTokens = actual tokens, requestCount = message_count,
  //   storageBytes = conversation_count
  // This reuses the existing table without schema changes.
  await db
    .insert(usageStats)
    .values({
      orgId: platformOrgId,
      userId: null,
      groupId: null,
      modelId: null,
      period: "day",
      periodStart: todayStart,
      promptTokens: Number(stats.org_count),
      completionTokens: Number(stats.user_count),
      totalTokens: Number(stats.today_tokens),
      costCents: 0,
      requestCount: Number(stats.today_requests),
      errorCount: 0,
      storageBytes: Number(stats.conversation_count),
    })
    .onConflictDoUpdate({
      target: [usageStats.orgId, usageStats.userId, usageStats.groupId, usageStats.modelId, usageStats.period, usageStats.periodStart],
      set: {
        promptTokens: Number(stats.org_count),
        completionTokens: Number(stats.user_count),
        totalTokens: Number(stats.today_tokens),
        requestCount: Number(stats.today_requests),
        storageBytes: Number(stats.conversation_count),
        updatedAt: now,
      },
    });

  return { snapshotsCreated: 1 };
}

/**
 * Backfill historical platform metrics from existing data.
 * Computes daily snapshots for the past N days.
 */
export async function backfillPlatformMetrics(days: number = 90): Promise<{ snapshotsCreated: number }> {
  const [systemOrg] = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isSystemOrg, true));

  if (!systemOrg) return { snapshotsCreated: 0 };

  let created = 0;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayStartISO = dayStart.toISOString();
    const dayEndISO = dayEnd.toISOString();

    const [stats] = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM organisations WHERE deleted_at IS NULL AND created_at < ${dayEndISO}::timestamptz) as org_count,
        (SELECT count(*)::int FROM users WHERE deleted_at IS NULL AND created_at < ${dayEndISO}::timestamptz) as user_count,
        (SELECT count(*)::int FROM conversations WHERE deleted_at IS NULL AND created_at < ${dayEndISO}::timestamptz) as conversation_count,
        (SELECT count(*)::int FROM messages WHERE created_at >= ${dayStartISO}::timestamptz AND created_at < ${dayEndISO}::timestamptz) as day_messages,
        (SELECT coalesce(sum((metadata->>'totalTokens')::bigint), 0) FROM messages WHERE sender_type = 'assistant' AND metadata->>'totalTokens' IS NOT NULL AND created_at >= ${dayStartISO}::timestamptz AND created_at < ${dayEndISO}::timestamptz) as day_tokens
    `) as any[];

    if (!stats) continue;

    await db
      .insert(usageStats)
      .values({
        orgId: systemOrg.id,
        userId: null,
        groupId: null,
        modelId: null,
        period: "day",
        periodStart: dayStart,
        promptTokens: Number(stats.org_count),
        completionTokens: Number(stats.user_count),
        totalTokens: Number(stats.day_tokens),
        requestCount: Number(stats.day_messages),
        storageBytes: Number(stats.conversation_count),
        costCents: 0,
        errorCount: 0,
      })
      .onConflictDoUpdate({
        target: [usageStats.orgId, usageStats.userId, usageStats.groupId, usageStats.modelId, usageStats.period, usageStats.periodStart],
        set: {
          promptTokens: Number(stats.org_count),
          completionTokens: Number(stats.user_count),
          totalTokens: Number(stats.day_tokens),
          requestCount: Number(stats.day_messages),
          storageBytes: Number(stats.conversation_count),
          updatedAt: new Date(),
        },
      });

    created++;
  }

  return { snapshotsCreated: created };
}

/**
 * Collect per-service health snapshot and store in systemHealthChecks.
 */
export async function collectHealthSnapshot(): Promise<{ checksStored: number }> {
  // This will be called from the same scheduled workflow
  // For now, health is checked on-demand via the admin API
  return { checksStored: 0 };
}
