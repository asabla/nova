/**
 * Admin authentication middleware.
 * Validates that the request comes from a super-admin user.
 * Completely separate from the main app's auth/org-scope chain.
 */

import { createMiddleware } from "hono/factory";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { users, sessions } from "@nova/shared/schemas";
import { eq, and, isNull, gte } from "drizzle-orm";

export const adminAuth = createMiddleware<AppContext>(async (c, next) => {
  // Extract session token from cookie or Authorization header
  const cookieHeader = c.req.header("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    }),
  );

  const token =
    cookies["better-auth.session_token"] ??
    cookies["nova.session_token"] ??
    c.req.header("authorization")?.replace("Bearer ", "");

  if (!token) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Look up session and user
  const [session] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(
      eq(sessions.token, token),
      gte(sessions.expiresAt, new Date()),
    ));

  if (!session) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  // Verify user exists and is a super-admin
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(and(
      eq(users.id, session.userId),
      isNull(users.deletedAt),
    ));

  if (!user || !user.isSuperAdmin) {
    return c.json({ error: "Super-admin access required" }, 403);
  }

  // Set context for downstream handlers
  c.set("userId", user.id);
  c.set("role", "super-admin");

  await next();
});
