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

// CORS — stricter: only admin domain
adminApp.use("*", cors({
  origin: env.ADMIN_CORS_ORIGIN ?? "http://localhost:5174",
  credentials: true,
}));

// Health check — unauthenticated (for Docker health checks)
adminApp.get("/health", (c) => c.json({ status: "ok", service: "admin-api" }));

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
