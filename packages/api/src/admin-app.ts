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

export const adminApp = new Hono<AppContext>();

// ---------------------------------------------------------------------------
// Admin Middleware Chain (separate from main app)
// ---------------------------------------------------------------------------

// CORS — stricter: only admin domain
adminApp.use("*", cors({
  origin: env.ADMIN_CORS_ORIGIN ?? "http://localhost:5174",
  credentials: true,
}));

// Structured logging
adminApp.use("*", logger());

// Health check — unauthenticated (for Docker health checks)
adminApp.get("/admin-api/health", (c) => c.json({ status: "ok", service: "admin-api" }));

// All other routes require super-admin authentication
adminApp.use("/admin-api/*", adminAuth);

// ---------------------------------------------------------------------------
// Admin Routes
// ---------------------------------------------------------------------------

adminApp.route("/admin-api/orgs", adminOrgRoutes);
adminApp.route("/admin-api/users", adminUserRoutes);
adminApp.route("/admin-api/stats", adminStatsRoutes);
adminApp.route("/admin-api/health-check", adminHealthRoutes);
adminApp.route("/admin-api/audit", adminAuditRoutes);
adminApp.route("/admin-api/settings", adminSettingsRoutes);
adminApp.route("/admin-api/marketplace", adminMarketplaceRoutes);
