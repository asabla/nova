import { eq, and, isNull } from "drizzle-orm";
import { db } from "./db";
import { models } from "@nova/shared/schemas";

let cachedDefaultModel: string | null = null;
let cachedEmbeddingModel: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isCacheStale(): boolean {
  return Date.now() - cacheTimestamp > CACHE_TTL_MS;
}

async function refreshCache(): Promise<void> {
  if (!isCacheStale()) return;

  const enabledModels = await db
    .select({
      modelIdExternal: models.modelIdExternal,
      isDefault: models.isDefault,
      capabilities: models.capabilities,
    })
    .from(models)
    .where(and(eq(models.isEnabled, true), isNull(models.deletedAt)));

  // Find default chat model
  const defaultChat = enabledModels.find((m) => m.isDefault);
  cachedDefaultModel = defaultChat?.modelIdExternal ?? enabledModels[0]?.modelIdExternal ?? null;

  // Find embedding model (capabilities include "embedding")
  const embeddingModel = enabledModels.find((m) => {
    const caps = m.capabilities as string[];
    return Array.isArray(caps) && caps.includes("embedding");
  });
  cachedEmbeddingModel = embeddingModel?.modelIdExternal ?? null;

  cacheTimestamp = Date.now();
}

/**
 * Returns the default chat/completion model from the DB.
 * Falls back to SUMMARY_MODEL / RESEARCH_MODEL env vars, then to first enabled model.
 */
export async function getDefaultChatModel(): Promise<string> {
  await refreshCache();
  return cachedDefaultModel ?? process.env.SUMMARY_MODEL ?? "default-model";
}

/**
 * Returns the embedding model from the DB.
 * Falls back to EMBEDDING_MODEL env var.
 */
export async function getDefaultEmbeddingModel(): Promise<string> {
  await refreshCache();
  return cachedEmbeddingModel ?? process.env.EMBEDDING_MODEL ?? "default-embedding-model";
}
