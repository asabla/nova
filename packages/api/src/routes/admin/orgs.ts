import { Hono } from "hono";
import { z } from "zod";
import { eq, sql, desc, and, isNull } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { organisations, userProfiles, users, conversations, messages, orgSettings } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";
import { writeAuditLog } from "../../services/audit.service";
import { zValidator } from "../../lib/validator";

const adminOrgRoutes = new Hono<AppContext>();

// List all organisations
adminOrgRoutes.get("/", async (c) => {
  const orgs = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      domain: organisations.domain,
      billingPlan: organisations.billingPlan,
      isSaas: organisations.isSaas,
      isSystemOrg: organisations.isSystemOrg,
      setupCompletedAt: organisations.setupCompletedAt,
      createdAt: organisations.createdAt,
      memberCount: sql<number>`(
        SELECT count(*) FROM user_profiles
        WHERE org_id = ${organisations.id} AND deleted_at IS NULL
      )`.mapWith(Number),
      conversationCount: sql<number>`(
        SELECT count(*) FROM conversations
        WHERE org_id = ${organisations.id} AND deleted_at IS NULL
      )`.mapWith(Number),
    })
    .from(organisations)
    .where(isNull(organisations.deletedAt))
    .orderBy(desc(organisations.createdAt));

  return c.json({ data: orgs });
});

// Get single organisation with details
adminOrgRoutes.get("/:orgId", async (c) => {
  const orgId = c.req.param("orgId");

  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId));
  if (!org) throw AppError.notFound("Organization");

  const members = await db
    .select({
      userId: userProfiles.userId,
      displayName: userProfiles.displayName,
      role: userProfiles.role,
      email: users.email,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .innerJoin(users, eq(userProfiles.userId, users.id))
    .where(and(eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)));

  const settings = await db
    .select({ key: orgSettings.key, value: orgSettings.value })
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), isNull(orgSettings.deletedAt)));

  return c.json({ ...org, members, settings });
});

// Create organisation
const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  billingPlan: z.enum(["free", "team", "enterprise"]).default("free"),
  adminEmail: z.string().email().optional(),
  isSystemOrg: z.boolean().optional(),
});

adminOrgRoutes.post("/", zValidator("json", createOrgSchema), async (c) => {
  const adminId = c.get("userId");
  const data = c.req.valid("json");

  const [existing] = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.slug, data.slug));

  if (existing) throw AppError.conflict(`Slug "${data.slug}" is already taken`);

  const [org] = await db.insert(organisations).values({
    name: data.name,
    slug: data.slug,
    billingPlan: data.billingPlan,
    isSystemOrg: data.isSystemOrg ?? false,
  }).returning();

  if (data.adminEmail) {
    const [user] = await db.select().from(users).where(eq(users.email, data.adminEmail));
    if (user) {
      await db.insert(userProfiles).values({
        userId: user.id,
        orgId: org.id,
        displayName: user.email.split("@")[0],
        role: "org-admin",
      });
    }
  }

  await writeAuditLog({
    orgId: org.id,
    actorId: adminId,
    actorType: "user",
    action: "org.create",
    resourceType: "org",
    resourceId: org.id,
    details: { name: data.name, slug: data.slug },
  });

  return c.json(org, 201);
});

// Update organisation
adminOrgRoutes.patch("/:orgId", async (c) => {
  const adminId = c.get("userId");
  const orgId = c.req.param("orgId");
  const body = await c.req.json();

  const [org] = await db.update(organisations)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(organisations.id, orgId))
    .returning();

  if (!org) throw AppError.notFound("Organization");

  await writeAuditLog({
    orgId,
    actorId: adminId,
    actorType: "user",
    action: "org.update",
    resourceType: "org",
    resourceId: orgId,
    details: body,
  });

  return c.json(org);
});

// Soft-delete organisation
adminOrgRoutes.delete("/:orgId", async (c) => {
  const adminId = c.get("userId");
  const orgId = c.req.param("orgId");

  const [org] = await db.update(organisations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(organisations.id, orgId))
    .returning();

  if (!org) throw AppError.notFound("Organization");

  await writeAuditLog({
    orgId,
    actorId: adminId,
    actorType: "user",
    action: "org.delete",
    resourceType: "org",
    resourceId: orgId,
  });

  return c.json({ ok: true });
});

// Get org members (for org detail page)
adminOrgRoutes.get("/:orgId/members", async (c) => {
  const orgId = c.req.param("orgId");

  const members = await db
    .select({
      userId: userProfiles.userId,
      displayName: userProfiles.displayName,
      role: userProfiles.role,
      email: users.email,
      isSuperAdmin: users.isSuperAdmin,
      lastActiveAt: users.updatedAt,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .innerJoin(users, eq(userProfiles.userId, users.id))
    .where(and(eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)))
    .orderBy(desc(userProfiles.createdAt));

  return c.json({ data: members });
});

// Update member role in org
adminOrgRoutes.patch("/:orgId/members/:userId/role", async (c) => {
  const { orgId, userId } = c.req.param() as { orgId: string; userId: string };
  const { role } = await c.req.json();

  const [profile] = await db.update(userProfiles)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(userProfiles.orgId, orgId), eq(userProfiles.userId, userId)))
    .returning();

  if (!profile) throw AppError.notFound("Member not found in organization");
  return c.json(profile);
});

// Get org usage/billing
adminOrgRoutes.get("/:orgId/usage", async (c) => {
  const orgId = c.req.param("orgId");
  const since = c.req.query("since");
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [usage] = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM conversations WHERE org_id = ${orgId} AND created_at >= ${sinceDate}) as conversations,
      (SELECT count(*) FROM messages WHERE org_id = ${orgId} AND created_at >= ${sinceDate}) as messages,
      (SELECT coalesce(sum((metadata->>'totalTokens')::int), 0) FROM messages WHERE org_id = ${orgId} AND sender_type = 'assistant' AND created_at >= ${sinceDate} AND metadata->>'totalTokens' IS NOT NULL) as tokens
  `);

  return c.json({ since: sinceDate.toISOString(), ...usage });
});

export { adminOrgRoutes };
