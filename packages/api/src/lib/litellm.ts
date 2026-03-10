import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import { env } from "./env";
import { traceGeneration, getHeliconeHeaders } from "./observability";

export const openai = new OpenAI({
  baseURL: env.LITELLM_API_URL,
  apiKey: env.LITELLM_MASTER_KEY,
  defaultHeaders: getHeliconeHeaders(),
  timeout: 120_000,
  maxRetries: 0, // We handle fallbacks ourselves
});

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
}

/**
 * Call LiteLLM chat/completions endpoint (non-streaming).
 * Supports automatic fallback to alternative models (Story #88, #200).
 */
export async function chatCompletion(request: ChatCompletionRequest): Promise<OpenAI.Chat.ChatCompletion> {
  const { fallbackModels, ...req } = request;
  const modelsToTry = [req.model, ...(fallbackModels ?? [])];

  let lastError: Error | null = null;
  const traceId = crypto.randomUUID();

  for (const model of modelsToTry) {
    const startTime = new Date().toISOString();
    try {
      const result = await openai.chat.completions.create({
        ...req,
        model,
        stream: false,
      } as ChatCompletionCreateParamsNonStreaming);

      // Tag the response with the model that actually served it
      if (model !== req.model) {
        (result as any)._fallbackModel = model;
        (result as any)._originalModel = req.model;
      }

      // Record trace for observability (Story #160)
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
      // If this is a server error and we have fallbacks, try the next model
      if (
        err instanceof OpenAI.APIError &&
        err.status !== undefined &&
        err.status >= 500 &&
        modelsToTry.indexOf(model) < modelsToTry.length - 1
      ) {
        continue;
      }
      // For non-server errors or last model, throw immediately
      if (modelsToTry.indexOf(model) >= modelsToTry.length - 1) {
        throw lastError;
      }
      continue;
    }
  }

  throw lastError ?? new Error("No models available");
}

/**
 * Call LiteLLM chat/completions with streaming.
 * Returns an async iterable Stream<ChatCompletionChunk>.
 * Always requests usage in the final chunk via stream_options.
 * Supports automatic fallback to alternative models.
 */
export async function streamChatCompletion(
  request: ChatCompletionRequest,
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> & { toReadableStream(): ReadableStream }> {
  const { fallbackModels, ...req } = request;
  const modelsToTry = [req.model, ...(fallbackModels ?? [])];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const stream = await openai.chat.completions.create({
        ...req,
        model,
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

export async function listModels(): Promise<OpenAI.Models.ModelsPage> {
  return openai.models.list();
}

export async function generateEmbedding(
  text: string,
  model = env.EMBEDDING_MODEL ?? "lmstudio/text-embedding-nomic-embed-text-v1.5",
): Promise<number[] | null> {
  try {
    const result = await openai.embeddings.create({
      model,
      input: [text],
    }, {
      timeout: 10_000, // Short timeout for embeddings — fall back to text search if slow
    });
    return result.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
