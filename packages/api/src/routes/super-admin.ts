import { Hono } from "hono";
import { z } from "zod";
import { eq, sql, desc, and, isNull, gte } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import {
  organisations,
  userProfiles,
  users,
  conversations,
  messages,
  orgSettings,
} from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";
import { writeAuditLog } from "../services/audit.service";
import { requireRole } from "../middleware/rbac";
import { zValidator } from "@hono/zod-validator";

const superAdminRoutes = new Hono<AppContext>();

// All super-admin routes require super-admin role
superAdminRoutes.use("*", requireRole("super-admin"));

// ---------------------------------------------------------------------------
// GET /super-admin/orgs - List all organisations (Story #11)
// ---------------------------------------------------------------------------
superAdminRoutes.get("/orgs", async (c) => {
  const orgs = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      billingPlan: organisations.billingPlan,
      createdAt: organisations.createdAt,
      memberCount: sql<number>`(
        SELECT count(*) FROM user_profiles
        WHERE org_id = ${organisations.id} AND deleted_at IS NULL
      )`.mapWith(Number),
    })
    .from(organisations)
    .where(isNull(organisations.deletedAt))
    .orderBy(desc(organisations.createdAt));

  return c.json({ data: orgs });
});

// ---------------------------------------------------------------------------
// POST /super-admin/orgs - Create a new organisation (Story #11)
// ---------------------------------------------------------------------------
const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  billingPlan: z.enum(["free", "team", "enterprise"]).default("free"),
  adminEmail: z.string().email().optional(),
});

superAdminRoutes.post("/orgs", zValidator("json", createOrgSchema), async (c) => {
  const adminId = c.get("userId");
  const data = c.req.valid("json");

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.slug, data.slug));

  if (existing) {
    throw AppError.conflict(`Organization slug "${data.slug}" is already taken`);
  }

  const [org] = await db
    .insert(organisations)
    .values({
      name: data.name,
      slug: data.slug,
      billingPlan: data.billingPlan,
    })
    .returning();

  // If an admin email is provided, assign them as org-admin
  if (data.adminEmail) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.adminEmail));

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

// ---------------------------------------------------------------------------
// PATCH /super-admin/orgs/:orgId - Update organisation (Story #11)
// ---------------------------------------------------------------------------
const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  billingPlan: z.enum(["free", "team", "enterprise"]).optional(),
});

superAdminRoutes.patch("/orgs/:orgId", zValidator("json", updateOrgSchema), async (c) => {
  const adminId = c.get("userId");
  const orgId = c.req.param("orgId");
  const data = c.req.valid("json");

  const [org] = await db
    .update(organisations)
    .set({ ...data, updatedAt: new Date() })
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
    details: data,
  });

  return c.json(org);
});

// ---------------------------------------------------------------------------
// DELETE /super-admin/orgs/:orgId - Soft-delete organisation (Story #11)
// ---------------------------------------------------------------------------
superAdminRoutes.delete("/orgs/:orgId", async (c) => {
  const adminId = c.get("userId");
  const orgId = c.req.param("orgId");

  const [org] = await db
    .update(organisations)
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

// ---------------------------------------------------------------------------
// GET /super-admin/usage - Cross-org usage for billing (Story #15)
// ---------------------------------------------------------------------------
superAdminRoutes.get("/usage", async (c) => {
  const since = c.req.query("since");
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const usage = await db
    .select({
      orgId: organisations.id,
      orgName: organisations.name,
      billingPlan: organisations.billingPlan,
      memberCount: sql<number>`(
        SELECT count(*) FROM user_profiles
        WHERE org_id = ${organisations.id} AND deleted_at IS NULL
      )`.mapWith(Number),
      conversationCount: sql<number>`(
        SELECT count(*) FROM conversations
        WHERE org_id = ${organisations.id}
          AND created_at >= ${sinceDate}
      )`.mapWith(Number),
      messageCount: sql<number>`(
        SELECT count(*) FROM messages
        WHERE org_id = ${organisations.id}
          AND created_at >= ${sinceDate}
      )`.mapWith(Number),
      totalTokensUsed: sql<number>`(
        SELECT coalesce(sum((metadata->>'totalTokens')::int), 0)
        FROM messages
        WHERE org_id = ${organisations.id}
          AND sender_type = 'assistant'
          AND created_at >= ${sinceDate}
          AND metadata->>'totalTokens' IS NOT NULL
      )`.mapWith(Number),
    })
    .from(organisations)
    .where(isNull(organisations.deletedAt))
    .orderBy(desc(sql`"messageCount"`));

  return c.json({
    since: sinceDate.toISOString(),
    data: usage,
  });
});

// ---------------------------------------------------------------------------
// GET /super-admin/stats - Platform-wide statistics
// ---------------------------------------------------------------------------
superAdminRoutes.get("/stats", async (c) => {
  const [stats] = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM organisations WHERE deleted_at IS NULL) as org_count,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL) as user_count,
      (SELECT count(*) FROM conversations) as conversation_count,
      (SELECT count(*) FROM messages) as message_count
  `);

  return c.json(stats);
});

export { superAdminRoutes };
