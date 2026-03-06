import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { userProfiles, sessions, users } from "@nova/shared/schemas";
import { eq, and, isNull, ne } from "drizzle-orm";
import { AppError } from "@nova/shared/utils";
import { requireRole } from "../middleware/rbac";
import { writeAuditLog } from "../services/audit.service";
import { randomUUID, randomBytes } from "crypto";

const userRoutes = new Hono<AppContext>();

// GET /me - Get current user profile
userRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");

  const profile = await db
    .select()
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)));

  if (profile.length === 0) throw AppError.notFound("User profile");
  return c.json(profile[0]);
});

// PATCH /me - Update profile (name, avatar URL, timezone, language)
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  avatarUrl: z.string().url().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  fontSize: z.enum(["small", "medium", "large"]).optional(),
});

userRoutes.patch("/me", zValidator("json", updateProfileSchema), async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const data = c.req.valid("json");

  const result = await db
    .update(userProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)))
    .returning();

  if (result.length === 0) throw AppError.notFound("User profile");
  return c.json(result[0]);
});

// GET /me/sessions - List active sessions
userRoutes.get("/me/sessions", async (c) => {
  const userId = c.get("userId");

  const activeSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), isNull(sessions.deletedAt)));

  return c.json(activeSessions);
});

// DELETE /me/sessions/:id - Revoke a session
userRoutes.delete("/me/sessions/:sessionId", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");

  const result = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning();

  if (result.length === 0) throw AppError.notFound("Session");
  return c.json({ ok: true });
});

// POST /admin/impersonate/:userId - Admin: start impersonation
userRoutes.post("/admin/impersonate/:userId", requireRole("org-admin"), async (c) => {
  const adminId = c.get("userId");
  const orgId = c.get("orgId");
  const targetUserId = c.req.param("userId");

  if (adminId === targetUserId) {
    throw AppError.badRequest("Cannot impersonate yourself");
  }

  // Verify target user exists in this org
  const targetProfile = await db
    .select()
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, targetUserId), eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)));

  if (targetProfile.length === 0) throw AppError.notFound("User");

  // Generate an impersonation token (short-lived)
  const impersonationToken = randomBytes(32).toString("hex");

  // Audit log the impersonation
  await writeAuditLog({
    orgId,
    actorId: adminId,
    actorType: "user",
    impersonatorId: adminId,
    action: "user.impersonate.start",
    resourceType: "user",
    resourceId: targetUserId,
    details: { targetUserId, targetDisplayName: targetProfile[0].displayName },
  });

  return c.json({
    ok: true,
    impersonationToken,
    targetUserId,
    expiresInSeconds: 3600,
  });
});

// POST /admin/deactivate/:userId - Admin: deactivate user
userRoutes.post("/admin/deactivate/:userId", requireRole("org-admin"), async (c) => {
  const adminId = c.get("userId");
  const orgId = c.get("orgId");
  const targetUserId = c.req.param("userId");

  if (adminId === targetUserId) {
    throw AppError.badRequest("Cannot deactivate yourself");
  }

  const result = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(users.id, targetUserId), isNull(users.deletedAt)))
    .returning();

  if (result.length === 0) throw AppError.notFound("User");

  // Revoke all active sessions for this user
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, targetUserId), isNull(sessions.revokedAt)));

  await writeAuditLog({
    orgId,
    actorId: adminId,
    actorType: "user",
    action: "user.deactivate",
    resourceType: "user",
    resourceId: targetUserId,
  });

  return c.json({ ok: true });
});

// POST /admin/reactivate/:userId - Admin: reactivate user
userRoutes.post("/admin/reactivate/:userId", requireRole("org-admin"), async (c) => {
  const adminId = c.get("userId");
  const orgId = c.get("orgId");
  const targetUserId = c.req.param("userId");

  const result = await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(and(eq(users.id, targetUserId), isNull(users.deletedAt)))
    .returning();

  if (result.length === 0) throw AppError.notFound("User");

  await writeAuditLog({
    orgId,
    actorId: adminId,
    actorType: "user",
    action: "user.reactivate",
    resourceType: "user",
    resourceId: targetUserId,
  });

  return c.json({ ok: true });
});

// POST /admin/bulk-import - Admin: CSV import (parse CSV, create users)
userRoutes.post("/admin/bulk-import", requireRole("org-admin"), async (c) => {
  const adminId = c.get("userId");
  const orgId = c.get("orgId");
  const body = await c.req.json();

  const csvSchema = z.object({
    csv: z.string().min(1, "CSV data is required"),
  });

  const { csv } = csvSchema.parse(body);

  // Parse CSV: expected format "email,displayName,role" (header row optional)
  const lines = csv.trim().split("\n").map((line: string) => line.trim()).filter(Boolean);
  const hasHeader = lines[0]?.toLowerCase().startsWith("email");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const created: Array<{ email: string; displayName: string; role: string }> = [];
  const errors: Array<{ line: number; error: string }> = [];

  for (let i = 0; i < dataLines.length; i++) {
    const parts = dataLines[i].split(",").map((p: string) => p.trim());
    const email = parts[0];
    const displayName = parts[1] || email.split("@")[0];
    const role = parts[2] || "member";

    if (!email || !z.string().email().safeParse(email).success) {
      errors.push({ line: i + 1, error: `Invalid email: ${email}` });
      continue;
    }

    try {
      // Check if user already exists
      const existing = await db.select().from(users).where(eq(users.email, email));

      let userId: string;
      if (existing.length > 0) {
        userId = existing[0].id;
      } else {
        const [newUser] = await db.insert(users).values({ email }).returning();
        userId = newUser.id;
      }

      // Check if profile already exists in this org
      const existingProfile = await db
        .select()
        .from(userProfiles)
        .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));

      if (existingProfile.length === 0) {
        await db.insert(userProfiles).values({
          userId,
          orgId,
          displayName,
          role,
        });
      }

      created.push({ email, displayName, role });
    } catch (err) {
      errors.push({ line: i + 1, error: `Failed to create user: ${email}` });
    }
  }

  await writeAuditLog({
    orgId,
    actorId: adminId,
    actorType: "user",
    action: "user.bulk_import",
    resourceType: "user",
    resourceId: orgId,
    details: { totalProcessed: dataLines.length, created: created.length, errors: errors.length },
  });

  return c.json({ created, errors, total: dataLines.length }, 201);
});

// POST /admin/invite - Admin: invite user by email with expiring link
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.string().optional().default("member"),
  expiresInHours: z.number().int().positive().optional().default(72),
});

userRoutes.post("/admin/invite", requireRole("org-admin"), zValidator("json", inviteSchema), async (c) => {
  const adminId = c.get("userId");
  const orgId = c.get("orgId");
  const { email, role, expiresInHours } = c.req.valid("json");

  const inviteToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  // Stub: In production this would send an email. For now, return the token directly.
  await writeAuditLog({
    orgId,
    actorId: adminId,
    actorType: "user",
    action: "user.invite",
    resourceType: "user",
    resourceId: orgId,
    details: { email, role, expiresAt: expiresAt.toISOString() },
  });

  return c.json({
    ok: true,
    email,
    role,
    inviteToken,
    expiresAt: expiresAt.toISOString(),
    message: "Invite token generated. Email sending is not yet implemented.",
  }, 201);
});

export { userRoutes };
