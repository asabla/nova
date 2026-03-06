import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { userProfiles, sessions } from "@nova/shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { AppError } from "@nova/shared/utils";

const users = new Hono<AppContext>();

users.get("/me", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");

  const profile = await db
    .select()
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)));

  if (profile.length === 0) throw AppError.notFound("User profile");
  return c.json(profile[0]);
});

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  avatarUrl: z.string().url().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  fontSize: z.enum(["small", "medium", "large"]).optional(),
});

users.patch("/me", zValidator("json", updateProfileSchema), async (c) => {
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

users.get("/me/sessions", async (c) => {
  const userId = c.get("userId");

  const activeSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), isNull(sessions.deletedAt)));

  return c.json(activeSessions);
});

users.post("/me/sessions/:sessionId/revoke", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");

  const result = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning();

  if (result.length === 0) throw AppError.notFound("Session");
  return c.json({ ok: true });
});

export { users as userRoutes };
