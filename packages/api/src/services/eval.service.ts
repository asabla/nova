import { db } from "../lib/db";
import {
  evalRuns,
  evalDimensions,
  evalAggregates,
  systemPrompts,
  systemPromptVersions,
  promptOptimizationRuns,
  orgSettings,
} from "@nova/shared/schemas";
import { eq, and, desc, asc, isNull, gte, sql } from "drizzle-orm";
import { parsePagination, buildPaginatedResponse, type PaginationInput } from "@nova/shared/utils";

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(orgId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get 7-day aggregates
  const aggregates = await db
    .select()
    .from(evalAggregates)
    .where(
      and(
        eq(evalAggregates.orgId, orgId),
        eq(evalAggregates.period, "day"),
        gte(evalAggregates.periodStart, sevenDaysAgo),
      ),
    )
    .orderBy(asc(evalAggregates.periodStart));

  // Get overall stats
  const [stats] = await db
    .select({
      totalEvals: sql<number>`count(*)`,
      avgScore: sql<string>`avg(${evalRuns.overallScore})`,
      completedCount: sql<number>`count(*) filter (where ${evalRuns.status} = 'completed')`,
    })
    .from(evalRuns)
    .where(
      and(
        eq(evalRuns.orgId, orgId),
        gte(evalRuns.createdAt, sevenDaysAgo),
      ),
    );

  return { aggregates, stats };
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export async function getTrends(orgId: string, period: "7d" | "30d" | "90d") {
  const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
  const cutoff = new Date(Date.now() - daysMap[period] * 24 * 60 * 60 * 1000);

  return db
    .select()
    .from(evalAggregates)
    .where(
      and(
        eq(evalAggregates.orgId, orgId),
        eq(evalAggregates.period, "day"),
        gte(evalAggregates.periodStart, cutoff),
      ),
    )
    .orderBy(asc(evalAggregates.periodStart));
}

// ---------------------------------------------------------------------------
// Eval Runs
// ---------------------------------------------------------------------------

export async function listEvalRuns(orgId: string, pagination: PaginationInput, evalType?: string) {
  const { offset, limit, page, pageSize } = parsePagination(pagination);

  const where = evalType
    ? and(eq(evalRuns.orgId, orgId), eq(evalRuns.evalType, evalType))
    : eq(evalRuns.orgId, orgId);

  const [rows, [countResult]] = await Promise.all([
    db.select().from(evalRuns).where(where).orderBy(desc(evalRuns.createdAt)).offset(offset).limit(limit),
    db.select({ count: sql<number>`count(*)` }).from(evalRuns).where(where),
  ]);

  return buildPaginatedResponse(rows, countResult?.count ?? 0, page, pageSize);
}

export async function getEvalRun(orgId: string, evalRunId: string) {
  const [run] = await db
    .select()
    .from(evalRuns)
    .where(and(eq(evalRuns.id, evalRunId), eq(evalRuns.orgId, orgId)))
    .limit(1);
  return run ?? null;
}

// ---------------------------------------------------------------------------
// Eval Dimensions
// ---------------------------------------------------------------------------

export async function listDimensions(orgId: string) {
  return db
    .select()
    .from(evalDimensions)
    .where(and(eq(evalDimensions.orgId, orgId), isNull(evalDimensions.deletedAt)))
    .orderBy(asc(evalDimensions.evalType), desc(evalDimensions.weight));
}

export async function updateDimension(orgId: string, dimensionId: string, updates: { weight?: string; isEnabled?: boolean }) {
  const [result] = await db
    .update(evalDimensions)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(evalDimensions.id, dimensionId), eq(evalDimensions.orgId, orgId)))
    .returning();
  return result;
}

// ---------------------------------------------------------------------------
// System Prompts
// ---------------------------------------------------------------------------

export async function listSystemPrompts(orgId: string) {
  const prompts = await db
    .select()
    .from(systemPrompts)
    .where(and(eq(systemPrompts.orgId, orgId), isNull(systemPrompts.deletedAt)))
    .orderBy(asc(systemPrompts.slug));

  // Enrich with active version info
  const enriched = await Promise.all(
    prompts.map(async (sp) => {
      let activeVersion = null;
      if (sp.activeVersionId) {
        const [v] = await db
          .select({ version: systemPromptVersions.version, avgScore: systemPromptVersions.avgScore, evalCount: systemPromptVersions.evalCount })
          .from(systemPromptVersions)
          .where(eq(systemPromptVersions.id, sp.activeVersionId))
          .limit(1);
        activeVersion = v ?? null;
      }
      return { ...sp, activeVersion };
    }),
  );

  return enriched;
}

export async function listPromptVersions(orgId: string, slug: string) {
  const [sp] = await db
    .select({ id: systemPrompts.id })
    .from(systemPrompts)
    .where(and(eq(systemPrompts.orgId, orgId), eq(systemPrompts.slug, slug)))
    .limit(1);
  if (!sp) return [];

  return db
    .select()
    .from(systemPromptVersions)
    .where(eq(systemPromptVersions.systemPromptId, sp.id))
    .orderBy(desc(systemPromptVersions.version));
}

export async function approvePromptVersion(orgId: string, slug: string, versionId: string, userId: string) {
  const [updated] = await db
    .update(systemPromptVersions)
    .set({
      status: "testing",
      trafficPct: 20,
      approvedById: userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(systemPromptVersions.id, versionId), eq(systemPromptVersions.orgId, orgId)))
    .returning();

  // Update any linked optimization run
  await db
    .update(promptOptimizationRuns)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(promptOptimizationRuns.orgId, orgId), eq(promptOptimizationRuns.proposedVersionId, versionId)));

  return updated;
}

export async function rejectPromptVersion(orgId: string, versionId: string) {
  const [updated] = await db
    .update(systemPromptVersions)
    .set({ status: "retired", updatedAt: new Date() })
    .where(and(eq(systemPromptVersions.id, versionId), eq(systemPromptVersions.orgId, orgId)))
    .returning();

  // Update any linked optimization run
  await db
    .update(promptOptimizationRuns)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(promptOptimizationRuns.orgId, orgId), eq(promptOptimizationRuns.proposedVersionId, versionId)));

  return updated;
}

export async function deployPromptVersion(orgId: string, slug: string, versionId: string) {
  // Retire the current active version
  const [sp] = await db
    .select({ id: systemPrompts.id, activeVersionId: systemPrompts.activeVersionId })
    .from(systemPrompts)
    .where(and(eq(systemPrompts.orgId, orgId), eq(systemPrompts.slug, slug)))
    .limit(1);

  if (!sp) return null;

  if (sp.activeVersionId) {
    await db
      .update(systemPromptVersions)
      .set({ status: "retired", trafficPct: 0, updatedAt: new Date() })
      .where(eq(systemPromptVersions.id, sp.activeVersionId));
  }

  // Activate the new version
  const [newActive] = await db
    .update(systemPromptVersions)
    .set({ status: "active", trafficPct: 100, updatedAt: new Date() })
    .where(and(eq(systemPromptVersions.id, versionId), eq(systemPromptVersions.orgId, orgId)))
    .returning();

  // Update the system prompt to point to the new active version
  await db
    .update(systemPrompts)
    .set({ activeVersionId: versionId, updatedAt: new Date() })
    .where(eq(systemPrompts.id, sp.id));

  // Update any linked optimization run
  await db
    .update(promptOptimizationRuns)
    .set({ status: "deployed", updatedAt: new Date() })
    .where(and(eq(promptOptimizationRuns.orgId, orgId), eq(promptOptimizationRuns.proposedVersionId, versionId)));

  return newActive;
}

export async function updatePromptVersionTraffic(orgId: string, versionId: string, trafficPct: number) {
  const [updated] = await db
    .update(systemPromptVersions)
    .set({ trafficPct, updatedAt: new Date() })
    .where(and(eq(systemPromptVersions.id, versionId), eq(systemPromptVersions.orgId, orgId)))
    .returning();
  return updated;
}

// ---------------------------------------------------------------------------
// Optimizations
// ---------------------------------------------------------------------------

export async function listOptimizations(orgId: string) {
  return db
    .select()
    .from(promptOptimizationRuns)
    .where(eq(promptOptimizationRuns.orgId, orgId))
    .orderBy(desc(promptOptimizationRuns.createdAt))
    .limit(50);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const EVAL_SETTING_KEYS = [
  "eval_enabled",
  "eval_sample_rate",
  "eval_score_threshold_chat",
  "eval_score_threshold_planning",
  "eval_score_threshold_research",
  "eval_auto_optimize",
  "eval_ab_test_min_samples",
  "eval_optimization_cooldown_hours",
] as const;

export async function getEvalSettings(orgId: string) {
  const rows = await db
    .select({ key: orgSettings.key, value: orgSettings.value })
    .from(orgSettings)
    .where(
      and(
        eq(orgSettings.orgId, orgId),
        sql`${orgSettings.key} LIKE 'eval_%'`,
      ),
    );

  const settings: Record<string, string> = {
    eval_enabled: "true",
    eval_sample_rate: "0.20",
    eval_score_threshold_chat: "0.65",
    eval_score_threshold_planning: "0.70",
    eval_score_threshold_research: "0.70",
    eval_auto_optimize: "false",
    eval_ab_test_min_samples: "100",
    eval_optimization_cooldown_hours: "168",
  };

  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return settings;
}

export async function updateEvalSettings(orgId: string, updates: Record<string, string>) {
  for (const [key, value] of Object.entries(updates)) {
    if (!EVAL_SETTING_KEYS.includes(key as any)) continue;

    await db
      .insert(orgSettings)
      .values({ orgId, key, value })
      .onConflictDoUpdate({
        target: [orgSettings.orgId, orgSettings.key],
        set: { value, updatedAt: new Date() },
      });
  }
}
