import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "./db";
import { models, modelProviders } from "@nova/shared/schemas";
import { env } from "./env";
import { traceGeneration, getHeliconeHeaders } from "./observability";

// ─── Client resolution ──────────────────────────────

/** Fallback client using env vars (for dev or when DB has no providers) */
const fallbackClient = new OpenAI({
  baseURL: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  apiKey: env.OPENAI_API_KEY ?? "",
  defaultHeaders: getHeliconeHeaders(),
  timeout: 120_000,
  maxRetries: 0,
});

const clientCache = new Map<string, { client: OpenAI; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Resolve an OpenAI client for the given org.
 * Looks up the model's provider in the DB and returns a configured client.
 * Falls back to env-var-based client if no provider is found.
 */
async function getClientForModel(orgId: string | undefined, modelExternalId: string): Promise<OpenAI> {
  if (!orgId) return fallbackClient;

  const rows = await db
    .select({
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
        eq(models.modelIdExternal, modelExternalId),
        eq(models.isEnabled, true),
        isNull(models.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row?.apiKey) return fallbackClient;

  // Check cache
  const cached = clientCache.get(row.providerId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.client;

  const providerParams = row.providerParams as { defaultHeaders?: Record<string, string> } | null;

  let baseURL: string;
  if (row.apiBaseUrl) {
    baseURL = row.apiBaseUrl;
  } else {
    switch (row.providerType) {
      case "anthropic": baseURL = "https://api.anthropic.com/v1/"; break;
      case "ollama": baseURL = "http://localhost:11434/v1"; break;
      default: baseURL = "https://api.openai.com/v1"; break;
    }
  }

  const client = new OpenAI({
    baseURL,
    apiKey: row.apiKey,
    defaultHeaders: { ...getHeliconeHeaders(), ...providerParams?.defaultHeaders },
    timeout: 120_000,
    maxRetries: 0,
  });

  clientCache.set(row.providerId, { client, ts: Date.now() });
  return client;
}

// ─── Model params (drop_params replacement) ─────────

/**
 * Resolves a model identifier to its external ID.
 * Handles: "default" → org's default model, UUID → lookup by id, already-external-id → pass through.
 */
export async function resolveModelExternalId(orgId: string, modelIdOrName: string | null | undefined): Promise<string> {
  if (!modelIdOrName || modelIdOrName === "default") {
    // Find org's default model
    const [defaultModel] = await db.select({ modelIdExternal: models.modelIdExternal }).from(models)
      .where(and(eq(models.orgId, orgId), eq(models.isDefault, true), eq(models.isEnabled, true), isNull(models.deletedAt)))
      .limit(1);
    if (defaultModel) return defaultModel.modelIdExternal;
    // Fall back to any enabled model in the org
    const [anyModel] = await db.select({ modelIdExternal: models.modelIdExternal }).from(models)
      .where(and(eq(models.orgId, orgId), eq(models.isEnabled, true), isNull(models.deletedAt)))
      .limit(1);
    return anyModel?.modelIdExternal ?? "gpt-5.4";
  }
  // Check if it's a UUID (model table PK) and resolve to external ID
  if (modelIdOrName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
    const [row] = await db.select({ modelIdExternal: models.modelIdExternal }).from(models)
      .where(and(eq(models.id, modelIdOrName), isNull(models.deletedAt)))
      .limit(1);
    return row?.modelIdExternal ?? modelIdOrName;
  }
  return modelIdOrName;
}

interface ModelParams {
  dropParams?: string[];
  defaultOverrides?: Record<string, unknown>;
}

async function getModelParams(modelExternalId: string): Promise<ModelParams | null> {
  const rows = await db
    .select({ modelParams: models.modelParams })
    .from(models)
    .where(and(eq(models.modelIdExternal, modelExternalId), eq(models.isEnabled, true), isNull(models.deletedAt)))
    .limit(1);
  return (rows[0]?.modelParams as ModelParams) ?? null;
}

function applyDropParams(req: Record<string, unknown>, params: ModelParams | null): void {
  if (!params?.dropParams) return;
  for (const param of params.dropParams) {
    delete req[param];
  }
}

// ─── Model resolution ────────────────────────────────

/**
 * Resolve the default chat model from the DB.
 * Falls back to SUMMARY_MODEL env var, then first enabled model.
 */
export async function getDefaultChatModel(): Promise<string> {
  const rows = await db
    .select({ modelIdExternal: models.modelIdExternal })
    .from(models)
    .where(and(eq(models.isDefault, true), eq(models.isEnabled, true), isNull(models.deletedAt)))
    .limit(1);
  return rows[0]?.modelIdExternal ?? process.env.SUMMARY_MODEL ?? "gpt-4o";
}

// ─── Public API ─────────────────────────────────────

export { fallbackClient as openai };

interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string | null | undefined }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: string | object;
  response_format?: unknown;
  stop?: string | string[];
  fallbackModels?: string[];
  orgId?: string;
}

/**
 * Chat completions (non-streaming).
 * Supports automatic fallback to alternative models.
 */
export async function chatCompletion(request: ChatCompletionRequest): Promise<OpenAI.Chat.ChatCompletion> {
  const { fallbackModels, orgId, ...req } = request;
  const modelsToTry = [req.model, ...(fallbackModels ?? [])];

  let lastError: Error | null = null;
  const traceId = crypto.randomUUID();

  for (const model of modelsToTry) {
    const startTime = new Date().toISOString();
    const client = await getClientForModel(orgId, model);
    const modelParams = await getModelParams(model);
    const payload = { ...req, model } as Record<string, unknown>;
    applyDropParams(payload, modelParams);

    try {
      // Create OTel span for the LLM call
      const { trace: otelTrace, context: otelContext } = await import("@opentelemetry/api");
      const tracer = otelTrace.getTracer("nova-api");
      const span = tracer.startSpan(`llm.chat ${model}`, {
        attributes: {
          "gen_ai.system": "openai",
          "gen_ai.request.model": model,
          "gen_ai.request.max_tokens": (payload.max_tokens as number) ?? 0,
        },
      }, otelContext.active());

      const result = await client.chat.completions.create({
        ...payload,
        stream: false,
      } as ChatCompletionCreateParamsNonStreaming);

      span.setAttribute("gen_ai.usage.prompt_tokens", result.usage?.prompt_tokens ?? 0);
      span.setAttribute("gen_ai.usage.completion_tokens", result.usage?.completion_tokens ?? 0);
      span.setAttribute("gen_ai.response.model", result.model ?? model);
      span.end();

      if (model !== req.model) {
        (result as any)._fallbackModel = model;
        (result as any)._originalModel = req.model;
      }

      traceGeneration({
        traceId,
        model,
        input: req.messages,
        output: result.choices?.[0]?.message,
        usage: {
          promptTokens: result.usage?.prompt_tokens,
          completionTokens: result.usage?.completion_tokens,
          totalTokens: result.usage?.total_tokens,
        },
        startTime,
        endTime: new Date().toISOString(),
      });

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (
        err instanceof OpenAI.APIError &&
        err.status !== undefined &&
        err.status >= 500 &&
        modelsToTry.indexOf(model) < modelsToTry.length - 1
      ) {
        continue;
      }
      if (modelsToTry.indexOf(model) >= modelsToTry.length - 1) {
        throw lastError;
      }
      continue;
    }
  }

  throw lastError ?? new Error("No models available");
}

/**
 * Chat completions with streaming.
 * Returns an async iterable Stream<ChatCompletionChunk>.
 * Always requests usage in the final chunk via stream_options.
 * Supports automatic fallback to alternative models.
 */
export async function streamChatCompletion(
  request: ChatCompletionRequest,
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> & { toReadableStream(): ReadableStream }> {
  const { fallbackModels, orgId, ...req } = request;
  const modelsToTry = [req.model, ...(fallbackModels ?? [])];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const client = await getClientForModel(orgId, model);
    const modelParams = await getModelParams(model);
    const payload = { ...req, model } as Record<string, unknown>;
    applyDropParams(payload, modelParams);

    try {
      const stream = await client.chat.completions.create({
        ...payload,
        stream: true,
        stream_options: { include_usage: true },
      } as ChatCompletionCreateParamsStreaming);

      return stream as any;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (
        err instanceof OpenAI.APIError &&
        err.status !== undefined &&
        err.status >= 500 &&
        modelsToTry.indexOf(model) < modelsToTry.length - 1
      ) {
        continue;
      }
      if (modelsToTry.indexOf(model) >= modelsToTry.length - 1) {
        throw lastError;
      }
      continue;
    }
  }

  throw lastError ?? new Error("No models available");
}

/**
 * List models from the database (replaces LiteLLM /models endpoint).
 */
export async function listModels(orgId?: string): Promise<{ data: Array<{ id: string; object: string }> }> {
  const where = orgId
    ? and(eq(models.orgId, orgId), eq(models.isEnabled, true), isNull(models.deletedAt))
    : and(eq(models.isEnabled, true), isNull(models.deletedAt));

  const rows = await db
    .select({ modelIdExternal: models.modelIdExternal, name: models.name })
    .from(models)
    .where(where);

  return {
    data: rows.map((r) => ({ id: r.modelIdExternal, object: "model" })),
  };
}

/**
 * Generate an embedding vector for the given text.
 * Returns null on failure (graceful degradation to text search).
 */
export async function generateEmbedding(
  text: string,
  model?: string,
  orgId?: string,
): Promise<number[] | null> {
  const embeddingModel = model ?? env.EMBEDDING_MODEL ?? "text-embedding-3-small";
  const client = await getClientForModel(orgId, embeddingModel);

  try {
    const result = await client.embeddings.create({
      model: embeddingModel,
      input: [text],
    }, {
      timeout: 10_000,
    });
    return result.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
