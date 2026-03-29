import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { env } from "../../lib/env";
import { redis } from "../../lib/redis";

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
    const pong = await redis.ping();
    checks.redis = { status: pong === "PONG" ? "healthy" : "unhealthy", latencyMs: Date.now() - start };
  } catch (err: any) {
    checks.redis = { status: "unhealthy", error: err.message };
  }

  // Qdrant
  try {
    const qdrantUrl = env.QDRANT_URL ?? "http://qdrant:6333";
    const start = Date.now();
    const resp = await fetch(`${qdrantUrl}/healthz`, { signal: AbortSignal.timeout(5000) });
    checks.qdrant = { status: resp.ok ? "healthy" : "unhealthy", latencyMs: Date.now() - start };
  } catch (err: any) {
    checks.qdrant = { status: "unhealthy", error: err.message };
  }

  // MinIO
  try {
    const minioUrl = env.MINIO_ENDPOINT ?? "http://minio:9000";
    const start = Date.now();
    const resp = await fetch(`${minioUrl}/minio/health/live`, { signal: AbortSignal.timeout(5000) });
    checks.minio = { status: resp.ok ? "healthy" : "unhealthy", latencyMs: Date.now() - start };
  } catch (err: any) {
    checks.minio = { status: "unhealthy", error: err.message };
  }

  // Temporal (use the UI port which is HTTP)
  try {
    const temporalHost = env.TEMPORAL_HOST ?? "temporal";
    const start = Date.now();
    // Try the frontend HTTP health endpoint
    const resp = await fetch(`http://${temporalHost}:7233/api/v1/namespaces`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    checks.temporal = { status: resp?.ok ? "healthy" : "unknown", latencyMs: Date.now() - start };
  } catch {
    checks.temporal = { status: "unknown" };
  }

  // SearxNG
  try {
    const start = Date.now();
    const resp = await fetch("http://searxng:8080/healthz", { signal: AbortSignal.timeout(5000) });
    checks.searxng = { status: resp.ok ? "healthy" : "unhealthy", latencyMs: Date.now() - start };
  } catch (err: any) {
    checks.searxng = { status: "unhealthy", error: err.message };
  }

  const healthyCount = Object.values(checks).filter((c) => c.status === "healthy").length;
  const totalCount = Object.keys(checks).length;
  const allHealthy = healthyCount === totalCount;

  return c.json({
    status: allHealthy ? "healthy" : "degraded",
    healthy: healthyCount,
    total: totalCount,
    version: env.APP_VERSION ?? "dev",
    uptime: process.uptime(),
    checks,
  });
});

export { adminHealthRoutes };
