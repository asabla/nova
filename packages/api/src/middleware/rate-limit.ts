import { createMiddleware } from "hono/factory";
import { redis } from "../lib/redis";
import { RATE_LIMITS } from "@nova/shared/constants";

/**
 * Extract the client IP from x-forwarded-for.
 * Uses the rightmost non-private IP (set by our reverse proxy),
 * not the leftmost (which can be spoofed by the client).
 */
function getClientIp(header: string | undefined): string {
  if (!header) return "unknown";
  const ips = header.split(",").map((ip) => ip.trim());
  // Rightmost IP is the one added by our trusted proxy (nginx)
  return ips[ips.length - 1] || "unknown";
}

type RateLimit = { maxRequests: number; windowSeconds: number };

function createRateLimiterMiddleware(getLimit: (c: any) => { key: string; limit: RateLimit }) {
  return createMiddleware(async (c, next) => {
    const { key, limit } = getLimit(c);

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
}

/** General rate limiter — applied after auth, uses userId when available */
export const rateLimiter = () =>
  createRateLimiterMiddleware((c) => {
    const ip = getClientIp(c.req.header("x-forwarded-for"));
    const userId = c.get("userId") as string | undefined;
    const key = userId ? `rl:user:${userId}` : `rl:ip:${ip}`;
    const limit = userId ? RATE_LIMITS.PER_USER : RATE_LIMITS.PER_IP;
    return { key, limit };
  });

/** Stricter rate limiter for auth endpoints (login, register, password reset) */
export const authRateLimiter = () =>
  createRateLimiterMiddleware((c) => {
    const ip = getClientIp(c.req.header("x-forwarded-for"));
    return { key: `rl:auth:${ip}`, limit: RATE_LIMITS.AUTH };
  });

/** Rate limiter for webhook endpoints */
export const webhookRateLimiter = () =>
  createRateLimiterMiddleware((c) => {
    const ip = getClientIp(c.req.header("x-forwarded-for"));
    return { key: `rl:webhook:${ip}`, limit: RATE_LIMITS.WEBHOOKS };
  });
