/**
 * Admin API — Completely separate Hono app for platform administration.
 * Has its own middleware chain with no org-scope, no rate limiting.
 * Only accessible by super-admin users.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppContext } from "./types/context";
import { adminAuth } from "./middleware/admin-auth";
import { requestId } from "./middleware/request-id";
import { tracing } from "./middleware/tracing";
import { logger } from "./middleware/logger";
import { metricsMiddleware } from "./middleware/metrics";
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
  origin: (env.ADMIN_CORS_ORIGIN ?? "http://localhost:5174,http://localhost:5173,http://localhost:3000").split(",").map((o) => o.trim()),
  credentials: true,
}));

// Request ID, tracing, logging, metrics (same as main app)
adminApp.use("*", requestId());
adminApp.use("*", tracing());
adminApp.use("*", logger());
adminApp.use("*", metricsMiddleware());

// Health check — unauthenticated (for Docker health checks)
adminApp.get("/health", (c) => c.json({ status: "ok", service: "admin-api" }));

// Admin login — creates a session for super-admin users
adminApp.post("/auth/login", async (c) => {
  const { db: database } = await import("./lib/db");
  const { users } = await import("@nova/shared/schemas");
  const { eq, and, isNull } = await import("drizzle-orm");
  const { env: appEnv } = await import("./lib/env");

  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ type: "https://nova.dev/errors/validation", title: "Validation Error", status: 400, detail: "Email and password required" }, 400);

  // Verify credentials via Better Auth's sign-in endpoint (internal call)
  const apiUrl = `http://localhost:${appEnv.PORT}`;
  const authResp = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!authResp.ok) {
    return c.json({ type: "https://nova.dev/errors/unauthorized", title: "Unauthorized", status: 401, detail: "Invalid email or password" }, 401);
  }

  // Extract the session cookie set by Better Auth
  const setCookieHeaders = authResp.headers.getSetCookie?.() ?? [];
  const sessionCookie = setCookieHeaders.find((h) => h.startsWith("nova_session="));
  const token = sessionCookie?.match(/nova_session=([^;]+)/)?.[1];

  if (!token) {
    return c.json({ type: "https://nova.dev/errors/unauthorized", title: "Unauthorized", status: 401, detail: "Authentication failed — no session created" }, 401);
  }

  // Verify user is a super-admin
  const [user] = await database
    .select({ id: users.id, email: users.email, isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)));

  if (!user?.isSuperAdmin) {
    return c.json({ type: "https://nova.dev/errors/forbidden", title: "Forbidden", status: 403, detail: "Super-admin access required" }, 403);
  }

  // Forward the session cookie to the admin portal
  if (sessionCookie) {
    c.header("Set-Cookie", sessionCookie);
  }

  return c.json({ ok: true, email: user.email });
});

// Check current session
adminApp.get("/auth/me", async (c) => {
  const { db: database } = await import("./lib/db");
  const { users } = await import("@nova/shared/schemas");
  const { eq, and, isNull, sql } = await import("drizzle-orm");

  const cookieHeader = c.req.header("cookie") ?? "";
  const match = cookieHeader.match(/nova_session=([^;]+)/);
  const rawCookie = match?.[1];

  if (!rawCookie) return c.json({ authenticated: false }, 401);

  try {
    // Better Auth uses signed cookies: "token.signature" — extract just the token
    const decoded = decodeURIComponent(rawCookie);
    const token = decoded.split(".")[0];

    // Look up in Better Auth's session table (plain token, not hashed)
    const [session] = await database.execute(
      sql`SELECT user_id FROM session WHERE token = ${token} AND expires_at > NOW() LIMIT 1`
    ) as any[];

    if (!session) return c.json({ authenticated: false }, 401);

    // Get email from Better Auth user table, then find NOVA user
    const [baUser] = await database.execute(
      sql`SELECT email FROM "user" WHERE id = ${session.user_id} LIMIT 1`
    ) as any[];

    if (!baUser) return c.json({ authenticated: false }, 401);

    const [novaUser] = await database
      .select({ id: users.id, email: users.email, isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(and(eq(users.email, baUser.email), isNull(users.deletedAt)));

    if (!novaUser?.isSuperAdmin) return c.json({ authenticated: false }, 401);

    return c.json({ authenticated: true, email: novaUser.email });
  } catch {
    return c.json({ authenticated: false }, 401);
  }
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
