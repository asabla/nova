import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.REDIS_URL);

export async function closeRedis() {
  await redis.quit();
}
