import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, isNull, ilike, sql } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { groups, groupMemberships } from "@nova/shared/schemas";
import { userProfiles, users } from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

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
  monthlyTokenLimit: z.number().int().positive().optional(),
  monthlyCostLimitCents: z.number().int().positive().optional(),
  storageQuotaMb: z.number().int().positive().optional(),
  dataRetentionDays: z.number().int().positive().optional(),
});

groupRoutes.post("/", zValidator("json", createGroupSchema), async (c) => {
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

groupRoutes.patch("/:id", zValidator("json", updateGroupSchema), async (c) => {
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

groupRoutes.delete("/:id", async (c) => {
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
      userName: users.name,
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
groupRoutes.delete("/:id/members/:userId", async (c) => {
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

export { groupRoutes };
