import { eq, and, desc } from "drizzle-orm";
import { db } from "../lib/db";
import { apiKeys } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "nv_";
  for (let i = 0; i < 48; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const apikeyService = {
  async list(orgId: string, userId: string) {
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.userId, userId), eq(apiKeys.isRevoked, false)))
      .orderBy(desc(apiKeys.createdAt));
  },

  async create(orgId: string, userId: string, name: string) {
    const key = generateKey();
    const keyHash = await hashKey(key);
    const prefix = key.slice(0, 8);

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        orgId,
        userId,
        name,
        keyHash,
        prefix,
      })
      .returning();

    return { ...apiKey, key };
  },

  async revoke(orgId: string, userId: string, keyId: string) {
    const [apiKey] = await db
      .update(apiKeys)
      .set({ isRevoked: true, updatedAt: new Date() })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.orgId, orgId), eq(apiKeys.userId, userId)))
      .returning();

    if (!apiKey) throw AppError.notFound("API key not found");
    return apiKey;
  },

  async validateKey(key: string) {
    const keyHash = await hashKey(key);
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isRevoked, false)));

    if (!apiKey) return null;

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) return null;

    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id));

    return apiKey;
  },
};
