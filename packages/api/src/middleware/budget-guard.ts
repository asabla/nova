import { createMiddleware } from "hono/factory";
import { eq, and, sql, gte, isNull } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { groups, groupMemberships, usageStats } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

/**
 * Budget enforcement middleware (Stories #26, #197).
 * Checks if the user's group has exceeded its monthly token or cost limits
 * before allowing LLM requests through.
 * Applied to routes that call LLM APIs (messages, v1-chat, sandbox, etc).
 */
export function budgetGuard() {
  return createMiddleware<AppContext>(async (c, next) => {
    // Only check POST requests that trigger LLM calls
    if (c.req.method !== "POST") return next();

    const orgId = c.get("orgId");
    const userId = c.get("userId");

    if (!orgId || !userId) return next();

    try {
      // Find all groups this user belongs to
      const memberships = await db
        .select({ groupId: groupMemberships.groupId })
        .from(groupMemberships)
        .where(
          and(
            eq(groupMemberships.userId, userId),
            eq(groupMemberships.orgId, orgId),
            isNull(groupMemberships.deletedAt),
          ),
        );

      if (memberships.length === 0) return next();

      const groupIds = memberships.map((m) => m.groupId);

      // Get group limits
      const userGroups = await db
        .select()
        .from(groups)
        .where(
          and(
            sql`${groups.id} = ANY(${groupIds})`,
            eq(groups.orgId, orgId),
            isNull(groups.deletedAt),
          ),
        );

      // Check each group's limits
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      for (const group of userGroups) {
        const tokenLimit = (group as any).monthlyTokenLimit as number | null;
        const costLimit = (group as any).monthlyCostLimitCents as number | null;

        if (!tokenLimit && !costLimit) continue;

        // Get current month usage for this group's members
        const [usage] = await db
          .select({
            totalTokens: sql<number>`COALESCE(SUM(${usageStats.totalTokens}), 0)::int`,
            totalCost: sql<number>`COALESCE(SUM(${usageStats.costCents}), 0)::int`,
          })
          .from(usageStats)
          .innerJoin(groupMemberships, eq(usageStats.userId, groupMemberships.userId))
          .where(
            and(
              eq(groupMemberships.groupId, group.id),
              eq(usageStats.orgId, orgId),
              gte(usageStats.createdAt, startOfMonth),
            ),
          );

        if (tokenLimit && usage.totalTokens >= tokenLimit) {
          throw AppError.forbidden(
            `Monthly token limit exceeded for group "${group.name}". ` +
            `Used: ${usage.totalTokens.toLocaleString()} / Limit: ${tokenLimit.toLocaleString()}. ` +
            `Resets on the 1st of next month.`,
          );
        }

        if (costLimit && usage.totalCost >= costLimit) {
          const usedDollars = (usage.totalCost / 100).toFixed(2);
          const limitDollars = (costLimit / 100).toFixed(2);
          throw AppError.forbidden(
            `Monthly cost limit exceeded for group "${group.name}". ` +
            `Used: $${usedDollars} / Limit: $${limitDollars}. ` +
            `Resets on the 1st of next month.`,
          );
        }

        // Warn if approaching limit (>80%)
        if (tokenLimit && usage.totalTokens >= tokenLimit * 0.8) {
          c.header("X-Budget-Warning", "approaching-token-limit");
          c.header("X-Budget-Usage-Pct", String(Math.round((usage.totalTokens / tokenLimit) * 100)));
        }
        if (costLimit && usage.totalCost >= costLimit * 0.8) {
          c.header("X-Budget-Warning", "approaching-cost-limit");
          c.header("X-Budget-Usage-Pct", String(Math.round((usage.totalCost / costLimit) * 100)));
        }
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Budget check failures shouldn't block requests - log and continue
      console.error("Budget guard check failed:", err);
    }

    return next();
  });
}
