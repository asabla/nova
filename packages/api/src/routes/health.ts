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

// Diagnostic test runner (Story #205)
// Tests all external service connections and reports results
health.post("/diagnostics", async (c) => {
  const results: Record<string, {
    status: "pass" | "fail" | "warn";
    message: string;
    latencyMs: number;
    details?: unknown;
  }> = {};

  // 1. Database connectivity + version
  try {
    const start = performance.now();
    const [row] = (await db.execute(sql`SELECT version() AS v, current_database() AS db, pg_database_size(current_database()) AS size`)) as any[];
    results.database = {
      status: "pass",
      message: `Connected to ${row?.db}`,
      latencyMs: Math.round(performance.now() - start),
      details: { version: row?.v, sizeBytes: row?.size },
    };
  } catch (err: any) {
    results.database = { status: "fail", message: err.message, latencyMs: 0 };
  }

  // 2. Database extensions (pgvector, pg_trgm)
  try {
    const start = performance.now();
    const extensions = (await db.execute(sql`SELECT extname FROM pg_extension`)) as any[];
    const extNames = extensions.map((e: any) => e.extname);
    const hasVector = extNames.includes("vector");
    const hasTrgm = extNames.includes("pg_trgm");
    results.database_extensions = {
      status: hasVector && hasTrgm ? "pass" : "warn",
      message: `Extensions: ${extNames.join(", ")}`,
      latencyMs: Math.round(performance.now() - start),
      details: { pgvector: hasVector, pg_trgm: hasTrgm },
    };
  } catch (err: any) {
    results.database_extensions = { status: "warn", message: err.message, latencyMs: 0 };
  }

  // 3. Redis
  try {
    const start = performance.now();
    const info = await redis.info("server");
    const versionMatch = info.match(/redis_version:(\S+)/);
    results.redis = {
      status: "pass",
      message: `Redis ${versionMatch?.[1] ?? "connected"}`,
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err: any) {
    results.redis = { status: "fail", message: err.message, latencyMs: 0 };
  }

  // 4. MinIO / Object Storage
  try {
    const start = performance.now();
    const minioUrl = env.MINIO_ENDPOINT ?? "http://localhost:9000";
    const res = await fetch(`${minioUrl}/minio/health/live`, { signal: AbortSignal.timeout(5000) });
    results.minio = {
      status: res.ok ? "pass" : "fail",
      message: res.ok ? "MinIO healthy" : `HTTP ${res.status}`,
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err: any) {
    results.minio = { status: "fail", message: err.message, latencyMs: 0 };
  }

  // 5. LiteLLM proxy
  try {
    const start = performance.now();
    const litellmUrl = env.LITELLM_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${litellmUrl}/health`, { signal: AbortSignal.timeout(5000) });
    results.litellm = {
      status: res.ok ? "pass" : "warn",
      message: res.ok ? "LiteLLM healthy" : `HTTP ${res.status}`,
      latencyMs: Math.round(performance.now() - start),
    };

    // Also try listing models
    const modelRes = await fetch(`${litellmUrl}/models`, {
      headers: { Authorization: `Bearer ${env.LITELLM_MASTER_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (modelRes.ok) {
      const modelData = await modelRes.json() as { data?: { id: string }[] };
      results.litellm_models = {
        status: "pass",
        message: `${modelData.data?.length ?? 0} model(s) available`,
        latencyMs: Math.round(performance.now() - start),
        details: { models: modelData.data?.map((m: any) => m.id).slice(0, 20) },
      };
    }
  } catch (err: any) {
    results.litellm = { status: "fail", message: err.message, latencyMs: 0 };
  }

  // 6. Temporal
  try {
    const start = performance.now();
    const temporalUrl = env.TEMPORAL_ADDRESS ?? "localhost:7233";
    const host = temporalUrl.includes("://") ? temporalUrl : `http://${temporalUrl}`;
    const res = await fetch(`${host}/api/v1/namespaces`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    results.temporal = {
      status: res ? "pass" : "warn",
      message: res ? "Temporal reachable" : "Temporal unreachable (may use gRPC)",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err: any) {
    results.temporal = { status: "warn", message: err.message, latencyMs: 0 };
  }

  // 7. DNS resolution test
  try {
    const start = performance.now();
    const res = await fetch("https://dns.google/resolve?name=example.com&type=A", { signal: AbortSignal.timeout(5000) });
    results.dns = {
      status: res.ok ? "pass" : "warn",
      message: res.ok ? "DNS resolution working" : "DNS may be impaired",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err: any) {
    results.dns = { status: "warn", message: err.message, latencyMs: 0 };
  }

  const passCount = Object.values(results).filter((r) => r.status === "pass").length;
  const failCount = Object.values(results).filter((r) => r.status === "fail").length;
  const totalCount = Object.keys(results).length;

  return c.json({
    status: failCount === 0 ? "healthy" : "degraded",
    summary: `${passCount}/${totalCount} checks passed, ${failCount} failed`,
    version: env.APP_VERSION ?? "dev",
    runtime: "bun",
    runtimeVersion: Bun.version,
    timestamp: new Date().toISOString(),
    results,
  });
});

export { health as healthRoutes };
