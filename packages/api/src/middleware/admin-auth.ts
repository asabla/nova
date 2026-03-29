/**
 * Admin authentication middleware.
 * Validates that the request comes from a super-admin user.
 * Reads the Better Auth session cookie and validates against
 * Better Auth's session table + NOVA's users table.
 */

import { createMiddleware } from "hono/factory";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { users } from "@nova/shared/schemas";
import { eq, and, isNull, gte, sql } from "drizzle-orm";

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

  const rawCookie =
    cookies["nova_session"] ??
    cookies["better-auth.session_token"] ??
    c.req.header("authorization")?.replace("Bearer ", "");

  if (!rawCookie) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Better Auth uses signed cookies: "token.signature" — extract just the token part
  // Also URL-decode since cookies may be percent-encoded
  const decoded = decodeURIComponent(rawCookie);
  const token = decoded.split(".")[0];

  // Look up session in Better Auth's session table (stores plain tokens)
  const [session] = await db.execute(
    sql`SELECT user_id, expires_at FROM session WHERE token = ${token} AND expires_at > NOW() LIMIT 1`
  ) as any[];

  if (!session) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  // Better Auth user_id references the "user" table, not NOVA's "users" table.
  // Find the NOVA user by email match.
  const [baUser] = await db.execute(
    sql`SELECT email FROM "user" WHERE id = ${session.user_id} LIMIT 1`
  ) as any[];

  if (!baUser) {
    return c.json({ error: "User not found" }, 401);
  }

  // Find the NOVA user by email and check super-admin
  const [novaUser] = await db
    .select({ id: users.id, email: users.email, isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(and(eq(users.email, baUser.email), isNull(users.deletedAt)));

  if (!novaUser?.isSuperAdmin) {
    return c.json({ error: "Super-admin access required" }, 403);
  }

  c.set("userId", novaUser.id);
  c.set("role", "super-admin");

  await next();
});
