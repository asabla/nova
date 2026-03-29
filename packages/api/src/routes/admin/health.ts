import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { env } from "../../lib/env";

const adminHealthRoutes = new Hono<AppContext>();

adminHealthRoutes.get("/", async (c) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // PostgreSQL
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.postgresql = { status: "healthy", latencyMs: Date.now() - start };
  } catch (err: any) {
    checks.postgresql = { status: "unhealthy", error: err.message };
  }

  // Redis
  try {
    const start = Date.now();
    const resp = await fetch(`http://${env.REDIS_HOST ?? "redis"}:${env.REDIS_PORT ?? 6379}/ping`).catch(() => null);
    checks.redis = resp ? { status: "healthy", latencyMs: Date.now() - start } : { status: "unknown" };
  } catch {
    checks.redis = { status: "unknown" };
  }

  // Temporal
  try {
    const start = Date.now();
    const resp = await fetch(`http://${env.TEMPORAL_HOST ?? "temporal"}:7233/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    checks.temporal = resp?.ok ? { status: "healthy", latencyMs: Date.now() - start } : { status: "unknown" };
  } catch {
    checks.temporal = { status: "unknown" };
  }

  // Qdrant
  try {
    const start = Date.now();
    const resp = await fetch(`http://${env.QDRANT_URL ?? "http://qdrant:6333"}/healthz`, { signal: AbortSignal.timeout(5000) });
    checks.qdrant = resp.ok ? { status: "healthy", latencyMs: Date.now() - start } : { status: "unhealthy" };
  } catch (err: any) {
    checks.qdrant = { status: "unhealthy", error: err.message };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");

  return c.json({
    status: allHealthy ? "healthy" : "degraded",
    version: env.APP_VERSION ?? "dev",
    uptime: process.uptime(),
    checks,
  });
});

export { adminHealthRoutes };
