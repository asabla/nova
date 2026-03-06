import { eq, and, sql, gte, lte, isNull, desc } from "drizzle-orm";
import { db } from "../lib/db";
import {
  usageStats,
  conversations,
  messages,
  userProfiles,
  users,
  models,
  groups,
  groupMemberships,
} from "@nova/shared/schemas";

interface DateRange {
  from?: Date;
  to?: Date;
}

export const analyticsService = {
  // ── Org-level summary ────────────────────────────────────────────
  async getOrgSummary(orgId: string, range?: DateRange) {
    const msgConditions: any[] = [eq(messages.orgId, orgId)];
    if (range?.from) msgConditions.push(gte(messages.createdAt, range.from));
    if (range?.to) msgConditions.push(lte(messages.createdAt, range.to));

    const usageConditions: any[] = [eq(usageStats.orgId, orgId)];
    if (range?.from) usageConditions.push(gte(usageStats.periodStart, range.from));
    if (range?.to) usageConditions.push(lte(usageStats.periodStart, range.to));

    const [[tokenStats], [userStats], [errorStats]] = await Promise.all([
      db.select({
        totalPromptTokens: sql<number>`coalesce(sum(${usageStats.promptTokens}), 0)::int`,
        totalCompletionTokens: sql<number>`coalesce(sum(${usageStats.completionTokens}), 0)::int`,
        totalTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        totalCostCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        totalRequests: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${usageStats.avgLatencyMs}), 0)::int`,
      })
        .from(usageStats)
        .where(and(...usageConditions)),

      db.select({
        activeUsers: sql<number>`count(distinct ${messages.senderUserId})::int`,
        totalUsers: sql<number>`(
          select count(*)::int from ${userProfiles}
          where ${userProfiles.orgId} = ${orgId}
          and ${userProfiles.deletedAt} is null
        )`,
      })
        .from(messages)
        .where(and(...msgConditions, sql`${messages.senderType} = 'user'`)),

      db.select({
        totalErrors: sql<number>`coalesce(sum(${usageStats.errorCount}), 0)::int`,
        totalRequests: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
      })
        .from(usageStats)
        .where(and(...usageConditions)),
    ]);

    const errorRate =
      errorStats.totalRequests > 0
        ? ((errorStats.totalErrors / errorStats.totalRequests) * 100).toFixed(2)
        : "0.00";

    return {
      totalPromptTokens: tokenStats.totalPromptTokens,
      totalCompletionTokens: tokenStats.totalCompletionTokens,
      totalTokens: tokenStats.totalTokens,
      totalCostCents: tokenStats.totalCostCents,
      totalRequests: tokenStats.totalRequests,
      avgLatencyMs: tokenStats.avgLatencyMs,
      activeUsers: userStats.activeUsers,
      totalUsers: userStats.totalUsers,
      totalErrors: errorStats.totalErrors,
      errorRate: parseFloat(errorRate),
    };
  },

  // ── Daily breakdown ──────────────────────────────────────────────
  async getDailyStats(orgId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        date: sql<string>`${usageStats.periodStart}::date`,
        promptTokens: sql<number>`coalesce(sum(${usageStats.promptTokens}), 0)::int`,
        completionTokens: sql<number>`coalesce(sum(${usageStats.completionTokens}), 0)::int`,
        totalTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        costCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
        errorCount: sql<number>`coalesce(sum(${usageStats.errorCount}), 0)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${usageStats.avgLatencyMs}), 0)::int`,
      })
      .from(usageStats)
      .where(
        and(
          eq(usageStats.orgId, orgId),
          gte(usageStats.periodStart, since),
        ),
      )
      .groupBy(sql`${usageStats.periodStart}::date`)
      .orderBy(sql`${usageStats.periodStart}::date`);

    return result;
  },

  // ── Per-model breakdown ──────────────────────────────────────────
  async getModelBreakdown(orgId: string, range?: DateRange) {
    const conditions: any[] = [
      eq(usageStats.orgId, orgId),
      sql`${usageStats.modelId} is not null`,
    ];
    if (range?.from) conditions.push(gte(usageStats.periodStart, range.from));
    if (range?.to) conditions.push(lte(usageStats.periodStart, range.to));

    const result = await db
      .select({
        modelId: usageStats.modelId,
        modelName: sql<string>`coalesce(${models.name}, 'Unknown')`,
        modelExternalId: sql<string>`coalesce(${models.modelIdExternal}, 'unknown')`,
        totalTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        promptTokens: sql<number>`coalesce(sum(${usageStats.promptTokens}), 0)::int`,
        completionTokens: sql<number>`coalesce(sum(${usageStats.completionTokens}), 0)::int`,
        costCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
        errorCount: sql<number>`coalesce(sum(${usageStats.errorCount}), 0)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${usageStats.avgLatencyMs}), 0)::int`,
      })
      .from(usageStats)
      .leftJoin(models, eq(usageStats.modelId, models.id))
      .where(and(...conditions))
      .groupBy(usageStats.modelId, models.name, models.modelIdExternal)
      .orderBy(sql`sum(${usageStats.totalTokens}) desc`);

    return result;
  },

  // ── Per-user breakdown (admin) ───────────────────────────────────
  async getUserBreakdown(orgId: string, range?: DateRange) {
    const conditions: any[] = [
      eq(usageStats.orgId, orgId),
      sql`${usageStats.userId} is not null`,
    ];
    if (range?.from) conditions.push(gte(usageStats.periodStart, range.from));
    if (range?.to) conditions.push(lte(usageStats.periodStart, range.to));

    const result = await db
      .select({
        userId: usageStats.userId,
        displayName: sql<string>`coalesce(${userProfiles.displayName}, ${users.email})`,
        email: users.email,
        totalTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        promptTokens: sql<number>`coalesce(sum(${usageStats.promptTokens}), 0)::int`,
        completionTokens: sql<number>`coalesce(sum(${usageStats.completionTokens}), 0)::int`,
        costCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
        errorCount: sql<number>`coalesce(sum(${usageStats.errorCount}), 0)::int`,
      })
      .from(usageStats)
      .leftJoin(users, eq(usageStats.userId, users.id))
      .leftJoin(
        userProfiles,
        and(eq(userProfiles.userId, users.id), eq(userProfiles.orgId, orgId)),
      )
      .where(and(...conditions))
      .groupBy(usageStats.userId, userProfiles.displayName, users.email)
      .orderBy(sql`sum(${usageStats.totalTokens}) desc`);

    return result;
  },

  // ── Per-group breakdown (admin) ──────────────────────────────────
  async getGroupBreakdown(orgId: string, range?: DateRange) {
    const conditions: any[] = [
      eq(usageStats.orgId, orgId),
      sql`${usageStats.groupId} is not null`,
    ];
    if (range?.from) conditions.push(gte(usageStats.periodStart, range.from));
    if (range?.to) conditions.push(lte(usageStats.periodStart, range.to));

    const result = await db
      .select({
        groupId: usageStats.groupId,
        groupName: sql<string>`coalesce(${groups.name}, 'Unknown')`,
        totalTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        costCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
        errorCount: sql<number>`coalesce(sum(${usageStats.errorCount}), 0)::int`,
        memberCount: sql<number>`(
          select count(*)::int from ${groupMemberships}
          where ${groupMemberships.groupId} = ${usageStats.groupId}
          and ${groupMemberships.deletedAt} is null
        )`,
      })
      .from(usageStats)
      .leftJoin(groups, eq(usageStats.groupId, groups.id))
      .where(and(...conditions))
      .groupBy(usageStats.groupId, groups.name)
      .orderBy(sql`sum(${usageStats.totalTokens}) desc`);

    return result;
  },

  // ── Cost breakdown with budget tracking ──────────────────────────
  async getCostBreakdown(orgId: string, range?: DateRange) {
    const conditions: any[] = [eq(usageStats.orgId, orgId)];
    if (range?.from) conditions.push(gte(usageStats.periodStart, range.from));
    if (range?.to) conditions.push(lte(usageStats.periodStart, range.to));

    // Current month costs
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthConditions: any[] = [
      eq(usageStats.orgId, orgId),
      gte(usageStats.periodStart, monthStart),
    ];

    const [[totalCosts], [monthlyCosts], dailyCosts] = await Promise.all([
      db.select({
        totalCostCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        totalRequests: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
        totalTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
      })
        .from(usageStats)
        .where(and(...conditions)),

      db.select({
        monthCostCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        monthRequests: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
        monthTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
      })
        .from(usageStats)
        .where(and(...monthConditions)),

      db.select({
        date: sql<string>`${usageStats.periodStart}::date`,
        costCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
      })
        .from(usageStats)
        .where(and(...conditions))
        .groupBy(sql`${usageStats.periodStart}::date`)
        .orderBy(sql`${usageStats.periodStart}::date`),
    ]);

    // Project monthly cost based on current rate
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0,
    ).getDate();
    const projectedMonthlyCostCents =
      dayOfMonth > 0
        ? Math.round((monthlyCosts.monthCostCents / dayOfMonth) * daysInMonth)
        : 0;

    return {
      totalCostCents: totalCosts.totalCostCents,
      totalRequests: totalCosts.totalRequests,
      totalTokens: totalCosts.totalTokens,
      currentMonthCostCents: monthlyCosts.monthCostCents,
      currentMonthRequests: monthlyCosts.monthRequests,
      currentMonthTokens: monthlyCosts.monthTokens,
      projectedMonthlyCostCents,
      dailyCosts,
    };
  },

  // ── Trend analysis ───────────────────────────────────────────────
  async getTrends(orgId: string, range?: DateRange) {
    const now = new Date();

    // Current week (Mon-Sun)
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay() + 1);
    currentWeekStart.setHours(0, 0, 0, 0);

    // Previous week
    const prevWeekStart = new Date(currentWeekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    // Current month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const periodQuery = (start: Date, end: Date) =>
      db.select({
        totalTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        costCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
        errorCount: sql<number>`coalesce(sum(${usageStats.errorCount}), 0)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${usageStats.avgLatencyMs}), 0)::int`,
      })
        .from(usageStats)
        .where(
          and(
            eq(usageStats.orgId, orgId),
            gte(usageStats.periodStart, start),
            lte(usageStats.periodStart, end),
          ),
        );

    const [[currentWeek], [prevWeek], [currentMonth], [prevMonth]] =
      await Promise.all([
        periodQuery(currentWeekStart, now),
        periodQuery(prevWeekStart, currentWeekStart),
        periodQuery(currentMonthStart, now),
        periodQuery(prevMonthStart, currentMonthStart),
      ]);

    const pctChange = (current: number, previous: number) =>
      previous > 0
        ? parseFloat((((current - previous) / previous) * 100).toFixed(1))
        : current > 0
          ? 100
          : 0;

    return {
      weekly: {
        current: currentWeek,
        previous: prevWeek,
        tokenChange: pctChange(currentWeek.totalTokens, prevWeek.totalTokens),
        costChange: pctChange(currentWeek.costCents, prevWeek.costCents),
        requestChange: pctChange(currentWeek.requestCount, prevWeek.requestCount),
      },
      monthly: {
        current: currentMonth,
        previous: prevMonth,
        tokenChange: pctChange(currentMonth.totalTokens, prevMonth.totalTokens),
        costChange: pctChange(currentMonth.costCents, prevMonth.costCents),
        requestChange: pctChange(currentMonth.requestCount, prevMonth.requestCount),
      },
    };
  },

  // ── Record a usage event ─────────────────────────────────────────
  async recordUsage(
    orgId: string,
    data: {
      userId?: string;
      groupId?: string;
      modelId?: string;
      promptTokens: number;
      completionTokens: number;
      costCents: number;
      latencyMs?: number;
      isError?: boolean;
    },
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert daily aggregation row
    await db
      .insert(usageStats)
      .values({
        orgId,
        userId: data.userId ?? null,
        groupId: data.groupId ?? null,
        modelId: data.modelId ?? null,
        period: "day",
        periodStart: today,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.promptTokens + data.completionTokens,
        costCents: data.costCents,
        requestCount: 1,
        errorCount: data.isError ? 1 : 0,
        avgLatencyMs: data.latencyMs ?? null,
      })
      .onConflictDoUpdate({
        target: [usageStats.id],
        set: {
          promptTokens: sql`${usageStats.promptTokens} + ${data.promptTokens}`,
          completionTokens: sql`${usageStats.completionTokens} + ${data.completionTokens}`,
          totalTokens: sql`${usageStats.totalTokens} + ${data.promptTokens + data.completionTokens}`,
          costCents: sql`${usageStats.costCents} + ${data.costCents}`,
          requestCount: sql`${usageStats.requestCount} + 1`,
          errorCount: sql`${usageStats.errorCount} + ${data.isError ? 1 : 0}`,
          avgLatencyMs: data.latencyMs
            ? sql`(coalesce(${usageStats.avgLatencyMs}, 0) * ${usageStats.requestCount} + ${data.latencyMs}) / (${usageStats.requestCount} + 1)`
            : usageStats.avgLatencyMs,
          updatedAt: new Date(),
        },
      });
  },

  // ── Personal usage (for /me endpoint) ────────────────────────────
  async getPersonalUsage(orgId: string, userId: string, range?: DateRange) {
    const conditions: any[] = [
      eq(usageStats.orgId, orgId),
      eq(usageStats.userId, userId),
    ];
    if (range?.from) conditions.push(gte(usageStats.periodStart, range.from));
    if (range?.to) conditions.push(lte(usageStats.periodStart, range.to));

    const [[summary], byModel, dailyUsage] = await Promise.all([
      db.select({
        totalTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        totalCostCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
        errorCount: sql<number>`coalesce(sum(${usageStats.errorCount}), 0)::int`,
        storageBytes: sql<number>`coalesce(max(${usageStats.storageBytes}), 0)::int`,
      })
        .from(usageStats)
        .where(and(...conditions)),

      db.select({
        modelId: usageStats.modelId,
        modelName: sql<string>`coalesce(${models.name}, 'Unknown')`,
        tokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        costCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
        requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)::int`,
      })
        .from(usageStats)
        .leftJoin(models, eq(usageStats.modelId, models.id))
        .where(and(...conditions, sql`${usageStats.modelId} is not null`))
        .groupBy(usageStats.modelId, models.name)
        .orderBy(sql`sum(${usageStats.totalTokens}) desc`),

      db.select({
        date: sql<string>`${usageStats.periodStart}::date`,
        tokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        costCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
      })
        .from(usageStats)
        .where(and(
          eq(usageStats.orgId, orgId),
          eq(usageStats.userId, userId),
          gte(usageStats.periodStart, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        ))
        .groupBy(sql`${usageStats.periodStart}::date`)
        .orderBy(sql`${usageStats.periodStart}::date`),
    ]);

    // Get budget info from user's group
    const [groupBudget] = await db
      .select({
        monthlyTokenLimit: groups.monthlyTokenLimit,
        monthlyCostLimitCents: groups.monthlyCostLimitCents,
        storageQuotaMb: groups.storageQuotaMb,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groupMemberships.groupId, groups.id))
      .where(
        and(
          eq(groupMemberships.userId, userId),
          eq(groupMemberships.orgId, orgId),
          isNull(groupMemberships.deletedAt),
        ),
      )
      .limit(1);

    // Current month usage for budget tracking
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [monthUsage] = await db
      .select({
        monthTokens: sql<number>`coalesce(sum(${usageStats.totalTokens}), 0)::int`,
        monthCostCents: sql<number>`coalesce(sum(${usageStats.costCents}), 0)::int`,
      })
      .from(usageStats)
      .where(
        and(
          eq(usageStats.orgId, orgId),
          eq(usageStats.userId, userId),
          gte(usageStats.periodStart, monthStart),
        ),
      );

    return {
      ...summary,
      byModel,
      dailyUsage,
      budget: groupBudget
        ? {
            monthlyTokenLimit: groupBudget.monthlyTokenLimit,
            monthlyCostLimitCents: groupBudget.monthlyCostLimitCents,
            storageQuotaMb: groupBudget.storageQuotaMb,
            currentMonthTokens: monthUsage?.monthTokens ?? 0,
            currentMonthCostCents: monthUsage?.monthCostCents ?? 0,
            tokenBudgetPercent: groupBudget.monthlyTokenLimit
              ? parseFloat(
                  (
                    ((monthUsage?.monthTokens ?? 0) /
                      groupBudget.monthlyTokenLimit) *
                    100
                  ).toFixed(1),
                )
              : null,
            costBudgetPercent: groupBudget.monthlyCostLimitCents
              ? parseFloat(
                  (
                    ((monthUsage?.monthCostCents ?? 0) /
                      groupBudget.monthlyCostLimitCents) *
                    100
                  ).toFixed(1),
                )
              : null,
          }
        : null,
    };
  },

  // ── CSV export ───────────────────────────────────────────────────
  async exportCsv(
    orgId: string,
    type: "daily" | "by-model" | "by-user",
    range?: DateRange,
  ): Promise<string> {
    let rows: Record<string, any>[];

    switch (type) {
      case "daily":
        rows = await this.getDailyStats(orgId, 90);
        break;
      case "by-model":
        rows = await this.getModelBreakdown(orgId, range);
        break;
      case "by-user":
        rows = await this.getUserBreakdown(orgId, range);
        break;
      default:
        rows = [];
    }

    if (rows.length === 0) return "";

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(","),
      ),
    ];

    return csvLines.join("\n");
  },

  // ── Legacy methods (preserved for backward compat) ───────────────
  async getOrgStats(orgId: string, from?: Date, to?: Date) {
    const conditions = [eq(conversations.orgId, orgId)];
    if (from) conditions.push(gte(conversations.createdAt, from));
    if (to) conditions.push(lte(conversations.createdAt, to));

    const [[convStats], [msgStats], [userStats]] = await Promise.all([
      db
        .select({
          totalConversations: sql<number>`count(*)::int`,
          activeConversations: sql<number>`count(*) filter (where ${conversations.isArchived} = false)::int`,
        })
        .from(conversations)
        .where(and(...conditions)),

      db
        .select({
          totalMessages: sql<number>`count(*)::int`,
          userMessages: sql<number>`count(*) filter (where ${messages.senderType} = 'user')::int`,
          assistantMessages: sql<number>`count(*) filter (where ${messages.senderType} = 'assistant')::int`,
          totalTokens: sql<number>`coalesce(sum(coalesce(${messages.tokenCountPrompt}, 0) + coalesce(${messages.tokenCountCompletion}, 0)), 0)::int`,
        })
        .from(messages)
        .where(eq(messages.orgId, orgId)),

      db
        .select({
          totalUsers: sql<number>`count(*)::int`,
        })
        .from(userProfiles)
        .where(
          and(eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)),
        ),
    ]);

    return {
      conversations: convStats,
      messages: msgStats,
      users: userStats,
    };
  },

  async getUsageOverTime(
    orgId: string,
    period: "day" | "week" | "month",
    days: number = 30,
  ) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        date: sql<string>`date_trunc(${period}, ${messages.createdAt})::date`,
        messageCount: sql<number>`count(*)::int`,
        tokenCount: sql<number>`coalesce(sum(coalesce(${messages.tokenCountPrompt}, 0) + coalesce(${messages.tokenCountCompletion}, 0)), 0)::int`,
      })
      .from(messages)
      .where(and(eq(messages.orgId, orgId), gte(messages.createdAt, since)))
      .groupBy(sql`date_trunc(${period}, ${messages.createdAt})`)
      .orderBy(sql`date_trunc(${period}, ${messages.createdAt})`);

    return result;
  },

  async getTopModels(orgId: string, limit: number = 10) {
    const result = await db
      .select({
        modelId: messages.modelId,
        count: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(coalesce(${messages.tokenCountPrompt}, 0) + coalesce(${messages.tokenCountCompletion}, 0)), 0)::int`,
      })
      .from(messages)
      .where(
        and(eq(messages.orgId, orgId), sql`${messages.modelId} is not null`),
      )
      .groupBy(messages.modelId)
      .orderBy(sql`count(*) desc`)
      .limit(limit);

    return result;
  },
};
