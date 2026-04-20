import Redis from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL);

export async function closeRedis() {
  await redis.quit();
}
