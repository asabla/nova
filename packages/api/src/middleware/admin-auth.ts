/**
 * Admin authentication middleware.
 * Validates that the request comes from a super-admin user.
 * Reads the Better Auth session cookie (nova_session), hashes it,
 * and looks up the session in the database.
 */

import { createMiddleware } from "hono/factory";
import { createHash } from "crypto";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { users, sessions } from "@nova/shared/schemas";
import { eq, and, isNull, gte } from "drizzle-orm";

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) cookies[k] = v.join("=");
  }
  return cookies;
}

export const adminAuth = createMiddleware<AppContext>(async (c, next) => {
  const cookieHeader = c.req.header("cookie") ?? "";
  const cookies = parseCookies(cookieHeader);

  // Better Auth cookie name (configured in auth.ts)
  const token =
    cookies["nova_session"] ??
    cookies["nova.session_token"] ??
    cookies["better-auth.session_token"] ??
    c.req.header("authorization")?.replace("Bearer ", "");

  if (!token) {
    console.log("[admin-auth] No session token found. Cookies:", Object.keys(cookies).join(", ") || "(none)");
    return c.json({ error: "Authentication required" }, 401);
  }

  console.log("[admin-auth] Token found from cookie, length:", token.length);

  // Better Auth stores sessions as SHA-256 hash of the token
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Look up session by token hash
  const [session] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(
      eq(sessions.tokenHash, tokenHash),
      gte(sessions.expiresAt, new Date()),
    ));

  if (!session) {
    console.log("[admin-auth] No session found for token hash:", tokenHash.slice(0, 12) + "...");
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
