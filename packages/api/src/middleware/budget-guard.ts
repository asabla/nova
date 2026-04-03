import { createMiddleware } from "hono/factory";
import { eq, and, sql, gte, isNull } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { logger } from "../lib/logger";
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

      // --- Model access enforcement ---
      // Check if any group restricts which models the user can access.
      // Union semantics: if ANY group allows the model, access is granted.
      const groupsWithModelRestrictions = userGroups.filter(
        (g) => Array.isArray((g as any).modelAccess) && ((g as any).modelAccess as string[]).length > 0,
      );

      if (groupsWithModelRestrictions.length > 0) {
        // Try to extract the requested model from the request body
        let requestedModel: string | undefined;
        try {
          const cloned = c.req.raw.clone();
          const body = await cloned.json();
          requestedModel = body?.model ?? body?.modelId;
        } catch { /* not JSON or no model field — skip check */ }

        if (requestedModel) {
          const allowedByAnyGroup = groupsWithModelRestrictions.some((g) => {
            const allowed = (g as any).modelAccess as string[];
            // Check against both UUID and external model name
            return allowed.includes(requestedModel!);
          });

          if (!allowedByAnyGroup) {
            throw AppError.forbidden(
              `Model "${requestedModel}" is not allowed for your group(s). ` +
              `Contact your organization admin to update model access permissions.`,
            );
          }
        }
      }

      // --- Budget limits enforcement ---
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
      logger.error({ err }, "Budget guard check failed");
    }

    return next();
  });
}
