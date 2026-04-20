import { eq, and, isNull } from "drizzle-orm";
import OpenAI from "openai";
import { db } from "./db.js";
import { models, modelProviders } from "@nova/shared/schemas";
import { env } from "./env.js";
import { createProviderClient, type ResolvedProvider } from "./model-client.js";

let cachedDefaultModel: string | null = null;
let cachedEmbeddingModel: string | null = null;
let cachedVisionModel: string | null = null;
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
    return Array.isArray(caps) && (caps.includes("embedding") || caps.includes("embeddings"));
  });
  cachedEmbeddingModel = embeddingModel?.modelIdExternal ?? null;

  // Find vision model: prefer default model if vision-capable, else any vision-capable model
  const hasVision = (m: { capabilities: unknown }) => {
    const caps = m.capabilities as string[];
    return Array.isArray(caps) && caps.includes("vision");
  };
  if (defaultChat && hasVision(defaultChat)) {
    cachedVisionModel = defaultChat.modelIdExternal;
  } else {
    const visionModel = enabledModels.find(hasVision);
    cachedVisionModel = visionModel?.modelIdExternal ?? null;
  }

  cacheTimestamp = Date.now();
}

/**
 * Returns the default chat/completion model from the DB.
 * Falls back to SUMMARY_MODEL / RESEARCH_MODEL env vars, then to first enabled model.
 */
export async function getDefaultChatModel(): Promise<string> {
  await refreshCache();
  return cachedDefaultModel ?? process.env.SUMMARY_MODEL ?? "gpt-5.4";
}

/**
 * Returns the embedding model from the DB.
 * Falls back to EMBEDDING_MODEL env var.
 */
export async function getDefaultEmbeddingModel(): Promise<string> {
  await refreshCache();
  return cachedEmbeddingModel ?? process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
}

/**
 * Returns a vision-capable model.
 * Priority: VISION_MODEL env var → default model (if vision-capable) → any vision-capable model → null
 */
export async function getVisionModel(): Promise<string | null> {
  if (env.VISION_MODEL) return env.VISION_MODEL;
  await refreshCache();
  return cachedVisionModel;
}

// ─── Provider-aware model resolution ─────────────────

/** Fallback client using env vars (for dev or when DB has no providers) */
function getFallbackClient(): OpenAI {
  return new OpenAI({
    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    timeout: 120_000,
    maxRetries: 0,
  });
}

/**
 * Resolves an OpenAI client for the given org and model.
 * Looks up the model's provider in the DB and returns a configured client.
 * Falls back to env-var-based client if no provider is found.
 */
export async function resolveModelClient(
  orgId: string,
  modelExternalId?: string,
): Promise<{ client: OpenAI; modelId: string }> {
  // Find the model and its provider
  const rows = await db
    .select({
      modelIdExternal: models.modelIdExternal,
      providerId: modelProviders.id,
      providerType: modelProviders.type,
      apiBaseUrl: modelProviders.apiBaseUrl,
      apiKey: modelProviders.apiKeyEncrypted,
      providerParams: modelProviders.providerParams,
    })
    .from(models)
    .innerJoin(modelProviders, eq(models.modelProviderId, modelProviders.id))
    .where(
      and(
        eq(models.orgId, orgId),
        eq(models.isEnabled, true),
        isNull(models.deletedAt),
        ...(modelExternalId ? [eq(models.modelIdExternal, modelExternalId)] : [eq(models.isDefault, true)]),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row?.apiKey) {
    // No provider configured — fall back to env vars
    const modelId = modelExternalId ?? await getDefaultChatModel();
    return { client: getFallbackClient(), modelId };
  }

  const config: ResolvedProvider = {
    type: row.providerType as ResolvedProvider["type"],
    apiBaseUrl: row.apiBaseUrl,
    apiKey: row.apiKey,
    providerParams: row.providerParams as ResolvedProvider["providerParams"],
  };

  return {
    client: createProviderClient(row.providerId, config),
    modelId: row.modelIdExternal,
  };
}

export interface ModelParams {
  dropParams?: string[];
  defaultOverrides?: Record<string, unknown>;
}

/**
 * Returns model-specific params (e.g. params to drop for reasoning models).
 */
export async function getModelParams(modelExternalId: string): Promise<ModelParams | null> {
  const rows = await db
    .select({ modelParams: models.modelParams })
    .from(models)
    .where(and(eq(models.modelIdExternal, modelExternalId), eq(models.isEnabled, true), isNull(models.deletedAt)))
    .limit(1);

  return (rows[0]?.modelParams as ModelParams) ?? null;
}

/**
 * Builds chat completion params with model-specific dropParams applied.
 * Removes unsupported params (e.g. temperature, max_tokens for reasoning models).
 */
export async function buildChatParams(
  model: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const modelParams = await getModelParams(model);
  if (!modelParams?.dropParams?.length) return params;
  const result = { ...params };
  for (const param of modelParams.dropParams) {
    delete result[param];
  }
  return result;
}
