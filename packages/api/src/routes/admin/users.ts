import { Hono } from "hono";
import { eq, sql, desc, and, isNull, ilike, or } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { users, userProfiles, organisations } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";
import { writeAuditLog } from "../../services/audit.service";

const adminUserRoutes = new Hono<AppContext>();

// List all users across orgs
adminUserRoutes.get("/", async (c) => {
  const search = c.req.query("search");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const offset = Number(c.req.query("offset") ?? 0);

  const conditions: any[] = [isNull(users.deletedAt)];
  if (search) {
    conditions.push(or(
      ilike(users.email, `%${search}%`),
      ilike(users.name, `%${search}%`),
    ));
  }

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isSuperAdmin: users.isSuperAdmin,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      orgCount: sql<number>`(
        SELECT count(*) FROM user_profiles
        WHERE user_id = ${users.id} AND deleted_at IS NULL
      )`.mapWith(Number),
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(...conditions));

  return c.json({ data: result, total: count });
});

// Get user details with all org memberships
adminUserRoutes.get("/:userId", async (c) => {
  const userId = c.req.param("userId");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw AppError.notFound("User");

  const memberships = await db
    .select({
      orgId: userProfiles.orgId,
      orgName: organisations.name,
      orgSlug: organisations.slug,
      role: userProfiles.role,
      joinedAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .innerJoin(organisations, eq(userProfiles.orgId, organisations.id))
    .where(and(eq(userProfiles.userId, userId), isNull(userProfiles.deletedAt)));

  return c.json({ ...user, memberships });
});

// Toggle super-admin status
adminUserRoutes.patch("/:userId/super-admin", async (c) => {
  const adminId = c.get("userId");
  const userId = c.req.param("userId");
  const { isSuperAdmin } = await c.req.json();

  const [user] = await db.update(users)
    .set({ isSuperAdmin: !!isSuperAdmin, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!user) throw AppError.notFound("User");

  await writeAuditLog({
    orgId: "system",
    actorId: adminId,
    actorType: "user",
    action: isSuperAdmin ? "user.grant_super_admin" : "user.revoke_super_admin",
    resourceType: "user",
    resourceId: userId,
  });

  return c.json(user);
});

// Deactivate user across all orgs
adminUserRoutes.post("/:userId/deactivate", async (c) => {
  const adminId = c.get("userId");
  const userId = c.req.param("userId");

  await db.update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  await writeAuditLog({
    orgId: "system",
    actorId: adminId,
    actorType: "user",
    action: "user.deactivate",
    resourceType: "user",
    resourceId: userId,
  });

  return c.json({ ok: true });
});

// Reactivate user
adminUserRoutes.post("/:userId/reactivate", async (c) => {
  const adminId = c.get("userId");
  const userId = c.req.param("userId");

  await db.update(users)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await writeAuditLog({
    orgId: "system",
    actorId: adminId,
    actorType: "user",
    action: "user.reactivate",
    resourceType: "user",
    resourceId: userId,
  });

  return c.json({ ok: true });
});

// Impersonate a user — creates a Better Auth session and returns a URL
adminUserRoutes.post("/:userId/impersonate", async (c) => {
  const adminId = c.get("userId");
  const userId = c.req.param("userId");
  const { orgId } = await c.req.json().catch(() => ({ orgId: undefined }));

  // Get target user
  const [targetUser] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));

  if (!targetUser) throw AppError.notFound("User");

  // Get the Better Auth user ID (different from NOVA user ID)
  const [baUser] = await db.execute(
    sql`SELECT id FROM "user" WHERE email = ${targetUser.email} LIMIT 1`
  ) as any[];

  if (!baUser) throw AppError.notFound("Better Auth user not found");

  // Create a Better Auth session (plain token in session table)
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.execute(sql`
    INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at, user_agent, ip_address, active_organization_id)
    VALUES (${randomBytes(16).toString("hex")}, ${token}, ${baUser.id}, ${expiresAt.toISOString()}::timestamp, NOW(), NOW(), ${"Impersonation by admin"}, ${"admin-portal"}, ${orgId ?? null})
  `);

  await writeAuditLog({
    orgId: orgId ?? "system",
    actorId: adminId,
    actorType: "user",
    action: "user.impersonate",
    resourceType: "user",
    resourceId: userId,
    details: { targetEmail: targetUser.email },
  });

  // Return the token — frontend will set it as a cookie and redirect to main app
  return c.json({
    ok: true,
    token,
    targetEmail: targetUser.email,
    expiresAt: expiresAt.toISOString(),
  });
});

export { adminUserRoutes };
