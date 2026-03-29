/**
 * Admin API — Completely separate Hono app for platform administration.
 * Has its own middleware chain with no org-scope, no rate limiting.
 * Only accessible by super-admin users.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppContext } from "./types/context";
import { adminAuth } from "./middleware/admin-auth";
import { adminOrgRoutes } from "./routes/admin/orgs";
import { adminUserRoutes } from "./routes/admin/users";
import { adminStatsRoutes } from "./routes/admin/stats";
import { adminHealthRoutes } from "./routes/admin/health";
import { adminAuditRoutes } from "./routes/admin/audit";
import { adminSettingsRoutes } from "./routes/admin/settings";
import { adminMarketplaceRoutes } from "./routes/admin/marketplace";
import { env } from "./lib/env";

export const adminApp = new Hono<AppContext>().basePath("/admin-api");

// ---------------------------------------------------------------------------
// Admin Middleware Chain (separate from main app)
// ---------------------------------------------------------------------------

// CORS — allow admin portal origins
adminApp.use("*", cors({
  origin: (env.ADMIN_CORS_ORIGIN ?? "http://localhost:5174,http://localhost:5173,http://localhost:3000").split(","),
  credentials: true,
}));

// Health check — unauthenticated (for Docker health checks)
adminApp.get("/health", (c) => c.json({ status: "ok", service: "admin-api" }));

// Admin login — creates a session for super-admin users
adminApp.post("/auth/login", async (c) => {
  const { createHash, randomBytes } = await import("crypto");
  const { db: database } = await import("./lib/db");
  const { users, sessions } = await import("@nova/shared/schemas");
  const { eq, and, isNull } = await import("drizzle-orm");

  const { email, password } = await c.req.json();
  if (!email) return c.json({ error: "Email required" }, 400);

  // Find the user
  const [user] = await database
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)));

  if (!user || !user.isSuperAdmin) {
    return c.json({ error: "Invalid credentials or not a super-admin" }, 401);
  }

  // Create a session token
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await database.insert(sessions).values({
    userId: user.id,
    tokenHash,
    expiresAt,
    userAgent: c.req.header("user-agent") ?? "admin-portal",
    ipAddress: c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for") ?? "unknown",
  });

  // Set the session cookie
  c.header("Set-Cookie", `nova_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);

  return c.json({ ok: true, email: user.email });
});

// Check current session
adminApp.get("/auth/me", async (c) => {
  const { createHash } = await import("crypto");
  const { db: database } = await import("./lib/db");
  const { users, sessions } = await import("@nova/shared/schemas");
  const { eq, and, isNull, gte } = await import("drizzle-orm");

  const cookieHeader = c.req.header("cookie") ?? "";
  const match = cookieHeader.match(/nova_session=([^;]+)/);
  const token = match?.[1];

  if (!token) return c.json({ authenticated: false }, 401);

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [session] = await database
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gte(sessions.expiresAt, new Date())));

  if (!session) return c.json({ authenticated: false }, 401);

  const [user] = await database
    .select({ id: users.id, email: users.email, isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(and(eq(users.id, session.userId), isNull(users.deletedAt)));

  if (!user?.isSuperAdmin) return c.json({ authenticated: false }, 401);

  return c.json({ authenticated: true, email: user.email });
});

// Logout — clear session
adminApp.post("/auth/logout", async (c) => {
  const { createHash } = await import("crypto");
  const { db: database } = await import("./lib/db");
  const { sessions } = await import("@nova/shared/schemas");
  const { eq } = await import("drizzle-orm");

  const cookieHeader = c.req.header("cookie") ?? "";
  const match = cookieHeader.match(/nova_session=([^;]+)/);
  const token = match?.[1];

  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await database.update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, tokenHash));
  }

  c.header("Set-Cookie", "nova_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return c.json({ ok: true });
});

// Apply auth to all sub-routes
const authed = new Hono<AppContext>();
authed.use("*", adminAuth);
authed.route("/orgs", adminOrgRoutes);
authed.route("/users", adminUserRoutes);
authed.route("/stats", adminStatsRoutes);
authed.route("/health-check", adminHealthRoutes);
authed.route("/audit", adminAuditRoutes);
authed.route("/settings", adminSettingsRoutes);
authed.route("/marketplace", adminMarketplaceRoutes);

adminApp.route("/", authed);
