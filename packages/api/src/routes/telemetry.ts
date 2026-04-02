import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { logger } from "../lib/logger";

const telemetryRoutes = new Hono<AppContext>();

const frontendEventSchema = z.object({
  events: z.array(z.object({
    type: z.enum(["error", "vital", "navigation"]),
    timestamp: z.string(),
    data: z.record(z.unknown()),
  })).max(50),
});

/**
 * POST /api/telemetry/frontend — receive batched frontend telemetry.
 * Rate-limited by the general API rate limiter. Logs events as structured JSON.
 */
telemetryRoutes.post("/frontend", zValidator("json", frontendEventSchema), async (c) => {
  const { events } = c.req.valid("json");
  const userId = c.get("userId") ?? "anonymous";

  for (const event of events) {
    if (event.type === "error") {
      logger.warn({
        source: "frontend",
        userId,
        event: "frontend.error",
        ...event.data,
        clientTimestamp: event.timestamp,
      }, "Frontend error reported");
    } else if (event.type === "vital") {
      logger.info({
        source: "frontend",
        userId,
        event: "frontend.vital",
        ...event.data,
        clientTimestamp: event.timestamp,
      }, "Web Vital reported");
    }
  }

  return c.json({ ok: true });
});

export { telemetryRoutes };
