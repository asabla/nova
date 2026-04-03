import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { eq, and, desc, isNull, ilike, sql } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { groups, groupMemberships, usageStats } from "@nova/shared/schemas";
import { userProfiles, users } from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";
import { requireRole } from "../middleware/rbac";

const groupRoutes = new Hono<AppContext>();

// List groups
groupRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const search = c.req.query("search");

  const conditions = [eq(groups.orgId, orgId), isNull(groups.deletedAt)];
  if (search) conditions.push(ilike(groups.name, `%${search}%`));

  const result = await db
    .select()
    .from(groups)
    .where(and(...conditions))
    .orderBy(desc(groups.createdAt))
    .limit(100);

  return c.json({ data: result });
});

// Get group by ID
groupRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, c.req.param("id")), eq(groups.orgId, orgId), isNull(groups.deletedAt)));

  if (!group) throw AppError.notFound("Group");

  // Get member count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, group.id), isNull(groupMemberships.deletedAt)));

  return c.json({ ...group, memberCount: count });
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  ssoGroupId: z.string().optional(),
  modelAccess: z.array(z.string()).optional(),
  defaultModelId: z.string().uuid().nullable().optional(),
  monthlyTokenLimit: z.number().int().positive().optional(),
  monthlyCostLimitCents: z.number().int().positive().optional(),
  storageQuotaMb: z.number().int().positive().optional(),
  dataRetentionDays: z.number().int().positive().optional(),
});

groupRoutes.post("/", requireRole("org-admin"), zValidator("json", createGroupSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const [group] = await db
    .insert(groups)
    .values({ ...data, orgId })
    .returning();

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "group.create",
    resourceType: "group",
    resourceId: group.id,
  });

  return c.json(group, 201);
});

const updateGroupSchema = createGroupSchema.partial();

groupRoutes.patch("/:id", requireRole("org-admin"), zValidator("json", updateGroupSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const [group] = await db
    .update(groups)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(groups.id, c.req.param("id")), eq(groups.orgId, orgId), isNull(groups.deletedAt)))
    .returning();

  if (!group) throw AppError.notFound("Group");

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "group.update",
    resourceType: "group",
    resourceId: group.id,
  });

  return c.json(group);
});

groupRoutes.delete("/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const [group] = await db
    .update(groups)
    .set({ deletedAt: new Date() })
    .where(and(eq(groups.id, c.req.param("id")), eq(groups.orgId, orgId), isNull(groups.deletedAt)))
    .returning();

  if (!group) throw AppError.notFound("Group");

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "group.delete",
    resourceType: "group",
    resourceId: group.id,
  });

  return c.json({ ok: true });
});

// List group members
groupRoutes.get("/:id/members", async (c) => {
  const orgId = c.get("orgId");
  const groupId = c.req.param("id");

  const members = await db
    .select({
      id: groupMemberships.id,
      userId: groupMemberships.userId,
      userName: users.email,
      userEmail: users.email,
      joinedAt: groupMemberships.createdAt,
    })
    .from(groupMemberships)
    .innerJoin(users, eq(users.id, groupMemberships.userId))
    .where(and(
      eq(groupMemberships.groupId, groupId),
      eq(groupMemberships.orgId, orgId),
      isNull(groupMemberships.deletedAt),
    ))
    .orderBy(desc(groupMemberships.createdAt));

  return c.json({ data: members });
});

// Add member to group
groupRoutes.post(
  "/:id/members",
  requireRole("org-admin"),
  zValidator("json", z.object({ userId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get("orgId");
    const actorId = c.get("userId");
    const groupId = c.req.param("id");
    const { userId } = c.req.valid("json");

    const [membership] = await db
      .insert(groupMemberships)
      .values({ groupId, userId, orgId })
      .onConflictDoNothing()
      .returning();

    if (!membership) throw AppError.conflict("User already in group");

    await writeAuditLog({
      orgId,
      actorId,
      actorType: "user",
      action: "group.member.add",
      resourceType: "group",
      resourceId: groupId,
      details: { userId },
    });

    return c.json(membership, 201);
  },
);

// Remove member from group
groupRoutes.delete("/:id/members/:userId", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const actorId = c.get("userId");
  const groupId = c.req.param("id");
  const userId = c.req.param("userId");

  const [membership] = await db
    .update(groupMemberships)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(groupMemberships.groupId, groupId),
      eq(groupMemberships.userId, userId),
      eq(groupMemberships.orgId, orgId),
      isNull(groupMemberships.deletedAt),
    ))
    .returning();

  if (!membership) throw AppError.notFound("Membership");

  await writeAuditLog({
    orgId,
    actorId,
    actorType: "user",
    action: "group.member.remove",
    resourceType: "group",
    resourceId: groupId,
    details: { userId },
  });

  return c.json({ ok: true });
});

// --- Model access restrictions ---

groupRoutes.get("/:id/model-access", async (c) => {
  const orgId = c.get("orgId");
  const groupId = c.req.param("id");

  const [group] = await db
    .select({ modelAccess: groups.modelAccess })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.orgId, orgId), isNull(groups.deletedAt)));

  if (!group) throw AppError.notFound("Group");

  // modelAccess is a jsonb column: null means unrestricted, array means only those models allowed
  const modelAccess = (group.modelAccess as string[] | null) ?? null;

  return c.json({
    restricted: modelAccess !== null,
    allowedModels: modelAccess ?? [],
  });
});

const modelAccessSchema = z.object({
  allowedModels: z.array(z.string().min(1)).min(0),
});

groupRoutes.patch("/:id/model-access", requireRole("org-admin"), zValidator("json", modelAccessSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const groupId = c.req.param("id");
  const { allowedModels } = c.req.valid("json");

  // Empty array = unrestricted (set to null), non-empty = restricted to those models
  const modelAccess = allowedModels.length > 0 ? allowedModels : null;

  const [group] = await db
    .update(groups)
    .set({ modelAccess, updatedAt: new Date() })
    .where(and(eq(groups.id, groupId), eq(groups.orgId, orgId), isNull(groups.deletedAt)))
    .returning();

  if (!group) throw AppError.notFound("Group");

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "group.model-access.update",
    resourceType: "group",
    resourceId: groupId,
    details: { allowedModels },
  });

  return c.json({
    restricted: modelAccess !== null,
    allowedModels: modelAccess ?? [],
  });
});

// --- Spending limits ---

groupRoutes.get("/:id/spending-limits", async (c) => {
  const orgId = c.get("orgId");
  const groupId = c.req.param("id");

  const [group] = await db
    .select({
      monthlyTokenLimit: groups.monthlyTokenLimit,
      monthlyCostLimitCents: groups.monthlyCostLimitCents,
      storageQuotaMb: groups.storageQuotaMb,
    })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.orgId, orgId), isNull(groups.deletedAt)));

  if (!group) throw AppError.notFound("Group");

  return c.json({
    monthlyTokenLimit: group.monthlyTokenLimit,
    monthlyCostLimitCents: group.monthlyCostLimitCents,
    monthlyCostLimitDollars: group.monthlyCostLimitCents != null ? group.monthlyCostLimitCents / 100 : null,
    storageQuotaMb: group.storageQuotaMb,
  });
});

const spendingLimitsSchema = z.object({
  monthlyTokenLimit: z.number().int().positive().nullable().optional(),
  monthlyCostLimitCents: z.number().int().positive().nullable().optional(),
  storageQuotaMb: z.number().int().positive().nullable().optional(),
});

groupRoutes.patch("/:id/spending-limits", requireRole("org-admin"), zValidator("json", spendingLimitsSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const groupId = c.req.param("id");
  const data = c.req.valid("json");

  const [group] = await db
    .update(groups)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(groups.id, groupId), eq(groups.orgId, orgId), isNull(groups.deletedAt)))
    .returning();

  if (!group) throw AppError.notFound("Group");

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "group.spending-limits.update",
    resourceType: "group",
    resourceId: groupId,
    details: data,
  });

  return c.json({
    monthlyTokenLimit: group.monthlyTokenLimit,
    monthlyCostLimitCents: group.monthlyCostLimitCents,
    monthlyCostLimitDollars: group.monthlyCostLimitCents != null ? group.monthlyCostLimitCents / 100 : null,
    storageQuotaMb: group.storageQuotaMb,
  });
});

// --- Usage statistics ---

groupRoutes.get("/:id/usage", async (c) => {
  const orgId = c.get("orgId");
  const groupId = c.req.param("id");
  const period = c.req.query("period") ?? "monthly";

  // Verify group exists
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.orgId, orgId), isNull(groups.deletedAt)));

  if (!group) throw AppError.notFound("Group");

  // Get aggregated usage stats for this group
  const stats = await db
    .select({
      period: usageStats.period,
      periodStart: usageStats.periodStart,
      promptTokens: sql<number>`COALESCE(SUM(${usageStats.promptTokens}), 0)::bigint`,
      completionTokens: sql<number>`COALESCE(SUM(${usageStats.completionTokens}), 0)::bigint`,
      totalTokens: sql<number>`COALESCE(SUM(${usageStats.totalTokens}), 0)::bigint`,
      costCents: sql<number>`COALESCE(SUM(${usageStats.costCents}), 0)::int`,
      requestCount: sql<number>`COALESCE(SUM(${usageStats.requestCount}), 0)::int`,
      errorCount: sql<number>`COALESCE(SUM(${usageStats.errorCount}), 0)::int`,
    })
    .from(usageStats)
    .where(and(
      eq(usageStats.orgId, orgId),
      eq(usageStats.groupId, groupId),
      eq(usageStats.period, period),
    ))
    .groupBy(usageStats.period, usageStats.periodStart)
    .orderBy(desc(usageStats.periodStart))
    .limit(12);

  // Calculate current period totals for limit comparison
  const now = new Date();
  const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [currentUsage] = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${usageStats.totalTokens}), 0)::bigint`,
      costCents: sql<number>`COALESCE(SUM(${usageStats.costCents}), 0)::int`,
    })
    .from(usageStats)
    .where(and(
      eq(usageStats.orgId, orgId),
      eq(usageStats.groupId, groupId),
      sql`${usageStats.periodStart} >= ${currentPeriodStart}`,
    ));

  return c.json({
    groupId,
    currentPeriod: {
      totalTokens: Number(currentUsage?.totalTokens ?? 0),
      costCents: Number(currentUsage?.costCents ?? 0),
      costDollars: Number(currentUsage?.costCents ?? 0) / 100,
      tokenLimitUsedPercent: group.monthlyTokenLimit
        ? Math.round((Number(currentUsage?.totalTokens ?? 0) / group.monthlyTokenLimit) * 100)
        : null,
      costLimitUsedPercent: group.monthlyCostLimitCents
        ? Math.round((Number(currentUsage?.costCents ?? 0) / group.monthlyCostLimitCents) * 100)
        : null,
    },
    limits: {
      monthlyTokenLimit: group.monthlyTokenLimit,
      monthlyCostLimitCents: group.monthlyCostLimitCents,
      storageQuotaMb: group.storageQuotaMb,
    },
    history: stats.map((s) => ({
      period: s.period,
      periodStart: s.periodStart,
      promptTokens: Number(s.promptTokens),
      completionTokens: Number(s.completionTokens),
      totalTokens: Number(s.totalTokens),
      costCents: Number(s.costCents),
      costDollars: Number(s.costCents) / 100,
      requestCount: Number(s.requestCount),
      errorCount: Number(s.errorCount),
    })),
  });
});

export { groupRoutes };
