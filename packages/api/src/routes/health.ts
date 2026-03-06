import { Hono } from "hono";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import { sql } from "drizzle-orm";

const health = new Hono();

health.get("/", async (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

health.get("/ready", async (c) => {
  const checks: Record<string, string> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return c.json({ status: allOk ? "ready" : "degraded", checks }, allOk ? 200 : 503);
});

export { health as healthRoutes };
