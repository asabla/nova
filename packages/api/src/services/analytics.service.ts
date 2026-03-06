import { eq, and, sql, gte, lte } from "drizzle-orm";
import { db } from "../lib/db";
import { usageStats, conversations, messages, users } from "@nova/shared/schemas";

export const analyticsService = {
  async getOrgStats(orgId: string, from?: Date, to?: Date) {
    const conditions = [eq(conversations.orgId, orgId)];
    if (from) conditions.push(gte(conversations.createdAt, from));
    if (to) conditions.push(lte(conversations.createdAt, to));

    const [[convStats], [msgStats], [userStats]] = await Promise.all([
      db.select({
        totalConversations: sql<number>`count(*)::int`,
        activeConversations: sql<number>`count(*) filter (where ${conversations.isArchived} = false)::int`,
      })
        .from(conversations)
        .where(and(...conditions)),

      db.select({
        totalMessages: sql<number>`count(*)::int`,
        userMessages: sql<number>`count(*) filter (where ${messages.senderType} = 'user')::int`,
        assistantMessages: sql<number>`count(*) filter (where ${messages.senderType} = 'assistant')::int`,
        totalTokens: sql<number>`coalesce(sum(${messages.tokenCount}), 0)::int`,
      })
        .from(messages)
        .where(eq(messages.orgId, orgId)),

      db.select({
        totalUsers: sql<number>`count(*)::int`,
        activeUsers: sql<number>`count(*) filter (where ${users.lastActiveAt} > now() - interval '7 days')::int`,
      })
        .from(users)
        .where(eq(users.orgId, orgId)),
    ]);

    return {
      conversations: convStats,
      messages: msgStats,
      users: userStats,
    };
  },

  async getUsageOverTime(orgId: string, period: "day" | "week" | "month", days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db.select({
      date: sql<string>`date_trunc(${period}, ${messages.createdAt})::date`,
      messageCount: sql<number>`count(*)::int`,
      tokenCount: sql<number>`coalesce(sum(${messages.tokenCount}), 0)::int`,
    })
      .from(messages)
      .where(and(eq(messages.orgId, orgId), gte(messages.createdAt, since)))
      .groupBy(sql`date_trunc(${period}, ${messages.createdAt})`)
      .orderBy(sql`date_trunc(${period}, ${messages.createdAt})`);

    return result;
  },

  async getTopModels(orgId: string, limit: number = 10) {
    const result = await db.select({
      model: messages.model,
      count: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(${messages.tokenCount}), 0)::int`,
    })
      .from(messages)
      .where(and(eq(messages.orgId, orgId), sql`${messages.model} is not null`))
      .groupBy(messages.model)
      .orderBy(sql`count(*) desc`)
      .limit(limit);

    return result;
  },
};
