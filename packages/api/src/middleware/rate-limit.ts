import { createMiddleware } from "hono/factory";
import { redis } from "../lib/redis";
import { RATE_LIMITS } from "@nova/shared/constants";

export const rateLimiter = () =>
  createMiddleware(async (c, next) => {
    const ip = c.req.header("x-forwarded-for") ?? "unknown";
    const userId = c.get("userId") as string | undefined;
    const key = userId ? `rl:user:${userId}` : `rl:ip:${ip}`;
    const limit = userId ? RATE_LIMITS.PER_USER : RATE_LIMITS.PER_IP;

    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, limit.windowSeconds);

    if (current > limit.maxRequests) {
      const ttl = await redis.ttl(key);
      return c.json(
        {
          type: "https://nova.dev/errors/rate-limited",
          title: "Rate limit exceeded",
          status: 429,
          detail: `Try again in ${ttl} seconds`,
          retryAfter: ttl,
        },
        429,
        { "Retry-After": String(ttl) },
      );
    }

    await next();
  });
