import Redis from "ioredis";
import { env } from "./env";
import { getTracer, isOtelEnabled, recordSpan } from "./telemetry";

const rawRedis = new Redis(env.REDIS_URL);
export const redisSub = new Redis(env.REDIS_URL);
export const redisPub = new Redis(env.REDIS_URL);

// Wrap redis with lightweight tracing for key operations
const tracedCommands = new Set(["get", "set", "del", "incr", "expire", "ttl", "rpush", "lrange", "exists", "publish"]);

export const redis = new Proxy(rawRedis, {
  get(target, prop: string) {
    const original = (target as any)[prop];
    if (typeof original !== "function" || !tracedCommands.has(prop) || !isOtelEnabled()) {
      return original.bind ? original.bind(target) : original;
    }
    return function (...args: any[]) {
      const tracer = getTracer();
      const startMs = Date.now();
      const span = tracer.startSpan(`redis.${prop}`, {
        attributes: { "db.system": "redis", "db.operation": prop },
      });
      const result = original.apply(target, args);
      if (result && typeof result.then === "function") {
        return result.then((v: any) => { span.end(); recordSpan(span, startMs); return v; })
                     .catch((e: any) => { span.end(); recordSpan(span, startMs); throw e; });
      }
      span.end();
      recordSpan(span, startMs);
      return result;
    };
  },
});
