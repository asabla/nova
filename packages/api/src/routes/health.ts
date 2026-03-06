import { Hono } from "hono";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import { sql } from "drizzle-orm";
import { env } from "../lib/env";

const health = new Hono();

health.get("/", async (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

health.get("/ready", async (c) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Database check
  try {
    const start = performance.now();
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latencyMs: Math.round(performance.now() - start) };
  } catch (err: any) {
    checks.database = { status: "error", error: err.message };
  }

  // Redis check
  try {
    const start = performance.now();
    await redis.ping();
    checks.redis = { status: "ok", latencyMs: Math.round(performance.now() - start) };
  } catch (err: any) {
    checks.redis = { status: "error", error: err.message };
  }

  // MinIO check
  try {
    const start = performance.now();
    const minioUrl = env.MINIO_ENDPOINT ?? "http://localhost:9000";
    const res = await fetch(`${minioUrl}/minio/health/live`, { signal: AbortSignal.timeout(5000) });
    checks.minio = { status: res.ok ? "ok" : "error", latencyMs: Math.round(performance.now() - start) };
  } catch (err: any) {
    checks.minio = { status: "error", error: err.message };
  }

  // LiteLLM check
  try {
    const start = performance.now();
    const litellmUrl = env.LITELLM_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${litellmUrl}/health`, { signal: AbortSignal.timeout(5000) });
    checks.litellm = { status: res.ok ? "ok" : "error", latencyMs: Math.round(performance.now() - start) };
  } catch (err: any) {
    checks.litellm = { status: "error", error: err.message };
  }

  // Temporal check
  try {
    const start = performance.now();
    const temporalUrl = env.TEMPORAL_ADDRESS ?? "localhost:7233";
    // Basic TCP connectivity check via fetch
    const host = temporalUrl.includes("://") ? temporalUrl : `http://${temporalUrl}`;
    const res = await fetch(`${host}/api/v1/namespaces`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    checks.temporal = {
      status: res ? "ok" : "unreachable",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err: any) {
    checks.temporal = { status: "error", error: err.message };
  }

  const allOk = Object.values(checks).every((v) => v.status === "ok");
  const anyError = Object.values(checks).some((v) => v.status === "error");

  // Build services array for SystemStatusBanner compatibility
  const services = Object.entries(checks).map(([name, check]) => ({
    name,
    status: check.status === "ok" ? "healthy" as const : "down" as const,
    message: check.error ?? (check.latencyMs ? `${check.latencyMs}ms` : undefined),
  }));

  return c.json({
    status: allOk ? "healthy" : anyError ? "down" : "degraded",
    version: env.APP_VERSION ?? "dev",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
    services,
  }, allOk ? 200 : 503);
});

// Detailed system info for admin dashboard
health.get("/system", async (c) => {
  const dbVersion = await db.execute(sql`SELECT version()`).catch(() => null);

  return c.json({
    version: env.APP_VERSION ?? "dev",
    runtime: "bun",
    runtimeVersion: Bun.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      version: (dbVersion as any)?.rows?.[0]?.version ?? "unknown",
    },
    env: {
      nodeEnv: env.NODE_ENV,
    },
    timestamp: new Date().toISOString(),
  });
});

export { health as healthRoutes };
