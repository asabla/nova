import { Hono } from "hono";
import { z } from "zod";
import { eq, sql, desc, asc, and, isNull, gte } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { organisations, userProfiles, users, conversations, messages, orgSettings, invitations, auditLogs } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";
import { writeAuditLog } from "../../services/audit.service";
import { zValidator } from "../../lib/validator";
import { randomBytes } from "crypto";

const adminOrgRoutes = new Hono<AppContext>();

// List all organisations
adminOrgRoutes.get("/", async (c) => {
  const result = await db.execute(sql`
    SELECT
      o.id, o.name, o.slug, o.domain, o.billing_plan as "billingPlan",
      o.is_saas as "isSaas", o.is_system_org as "isSystemOrg",
      o.setup_completed_at as "setupCompletedAt", o.created_at as "createdAt",
      (SELECT count(*)::int FROM user_profiles WHERE org_id = o.id AND deleted_at IS NULL) as "memberCount",
      (SELECT count(*)::int FROM conversations WHERE org_id = o.id AND deleted_at IS NULL) as "conversationCount"
    FROM organisations o
    WHERE o.deleted_at IS NULL
    ORDER BY o.created_at DESC
  `);

  return c.json({ data: result });
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
  const sinceISO = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [usage] = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM conversations WHERE org_id = ${orgId} AND created_at >= ${sinceISO}::timestamptz) as conversations,
      (SELECT count(*) FROM messages WHERE org_id = ${orgId} AND created_at >= ${sinceISO}::timestamptz) as messages,
      (SELECT coalesce(sum(coalesce(token_count_prompt,0) + coalesce(token_count_completion,0)), 0) FROM messages WHERE org_id = ${orgId} AND sender_type = 'assistant' AND created_at >= ${sinceISO}::timestamptz) as tokens
  `);

  return c.json({ since: sinceISO, ...usage });
});

// Remove member from org
adminOrgRoutes.delete("/:orgId/members/:userId", async (c) => {
  const adminId = c.get("userId");
  const { orgId, userId } = c.req.param() as { orgId: string; userId: string };

  const [profile] = await db.update(userProfiles)
    .set({ deletedAt: new Date() })
    .where(and(eq(userProfiles.orgId, orgId), eq(userProfiles.userId, userId), isNull(userProfiles.deletedAt)))
    .returning();

  if (!profile) throw AppError.notFound("Member not found");

  await writeAuditLog({ orgId, actorId: adminId, actorType: "user", action: "member.remove", resourceType: "user", resourceId: userId });
  return c.json({ ok: true });
});

// Invite member to org
adminOrgRoutes.post("/:orgId/invite", async (c) => {
  const adminId = c.get("userId");
  const orgId = c.req.param("orgId");
  const { email, role } = await c.req.json();

  if (!email) throw AppError.badRequest("Email required");

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invitation] = await db.insert(invitations).values({
    orgId,
    email,
    role: role ?? "member",
    token,
    expiresAt,
    invitedById: adminId,
  }).returning();

  await writeAuditLog({ orgId, actorId: adminId, actorType: "user", action: "member.invite", resourceType: "invitation", resourceId: invitation.id, details: { email, role } });
  return c.json(invitation, 201);
});

// List pending invitations
adminOrgRoutes.get("/:orgId/invitations", async (c) => {
  const orgId = c.req.param("orgId");

  const result = await db.select()
    .from(invitations)
    .where(and(eq(invitations.orgId, orgId), isNull(invitations.deletedAt), gte(invitations.expiresAt, new Date())))
    .orderBy(desc(invitations.createdAt));

  return c.json({ data: result });
});

// Revoke invitation
adminOrgRoutes.delete("/:orgId/invitations/:invitationId", async (c) => {
  const { orgId, invitationId } = c.req.param() as { orgId: string; invitationId: string };

  await db.update(invitations)
    .set({ deletedAt: new Date() })
    .where(and(eq(invitations.id, invitationId), eq(invitations.orgId, orgId)));

  return c.json({ ok: true });
});

// Get security policies for org
adminOrgRoutes.get("/:orgId/security", async (c) => {
  const orgId = c.req.param("orgId");

  const [setting] = await db.select()
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, "security_policies"), isNull(orgSettings.deletedAt)));

  const defaults = { mfaRequired: false, passwordMinLength: 8, requireUppercase: false, requireNumbers: false, requireSpecialChars: false, passwordExpiryDays: 0, sessionMaxAgeHours: 24 };
  const policies = setting ? { ...defaults, ...JSON.parse(setting.value) } : defaults;

  return c.json(policies);
});

// Update security policies
adminOrgRoutes.patch("/:orgId/security", async (c) => {
  const adminId = c.get("userId");
  const orgId = c.req.param("orgId");
  const body = await c.req.json();

  const [existing] = await db.select()
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, "security_policies")));

  if (existing) {
    await db.update(orgSettings).set({ value: JSON.stringify(body), updatedAt: new Date() }).where(eq(orgSettings.id, existing.id));
  } else {
    await db.insert(orgSettings).values({ orgId, key: "security_policies", value: JSON.stringify(body) });
  }

  await writeAuditLog({ orgId, actorId: adminId, actorType: "user", action: "security.update", resourceType: "org", resourceId: orgId });
  return c.json({ ok: true });
});

// Update branding
adminOrgRoutes.patch("/:orgId/branding", async (c) => {
  const orgId = c.req.param("orgId");
  const body = await c.req.json();

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
  if (body.faviconUrl !== undefined) updateData.faviconUrl = body.faviconUrl;
  if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor;
  if (body.customCss !== undefined) updateData.customCss = body.customCss;

  const [org] = await db.update(organisations).set(updateData).where(eq(organisations.id, orgId)).returning();
  if (!org) throw AppError.notFound("Organization");

  return c.json(org);
});

// Daily usage time-series for a specific org
adminOrgRoutes.get("/:orgId/usage/daily", async (c) => {
  const orgId = c.req.param("orgId");
  const days = Math.min(Number(c.req.query("days") ?? 30), 365);
  const sinceISO = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.execute(sql`
    SELECT
      date_trunc('day', created_at) as date,
      count(*)::int as messages,
      coalesce(sum(coalesce(token_count_prompt,0) + coalesce(token_count_completion,0)), 0)::bigint as tokens
    FROM messages
    WHERE org_id = ${orgId}
      AND created_at >= ${sinceISO}::timestamptz
    GROUP BY date_trunc('day', created_at)
    ORDER BY date ASC
  `);

  return c.json({ data: result });
});

// Org audit log
adminOrgRoutes.get("/:orgId/audit", async (c) => {
  const orgId = c.req.param("orgId");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);

  const result = await db.select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return c.json({ data: result });
});

// Ensure the current admin user has a profile in this org (for "Open in App")
adminOrgRoutes.post("/:orgId/ensure-access", async (c) => {
  const adminId = c.get("userId");
  const orgId = c.req.param("orgId");

  // Check if admin already has a profile in this org
  const [existing] = await db.select()
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, adminId), eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)));

  if (existing) {
    return c.json({ ok: true, role: existing.role });
  }

  // Create an org-admin profile so the admin can access this org in the main app
  const [novaUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, adminId));
  await db.insert(userProfiles).values({
    userId: adminId,
    orgId,
    displayName: novaUser?.email?.split("@")[0] ?? "Admin",
    role: "org-admin",
  });

  await writeAuditLog({
    orgId,
    actorId: adminId,
    actorType: "user",
    action: "admin.ensure_access",
    resourceType: "org",
    resourceId: orgId,
  });

  return c.json({ ok: true, role: "org-admin" });
});

export { adminOrgRoutes };
