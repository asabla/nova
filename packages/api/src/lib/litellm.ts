import { env } from "./env";
import { traceGeneration, getHeliconeHeaders } from "./observability";

interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string | null | undefined }>;
  stream?: boolean;
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
 * Call LiteLLM chat/completions endpoint.
 * Supports automatic fallback to alternative models (Story #88, #200).
 */
export async function chatCompletion(request: ChatCompletionRequest): Promise<any> {
  const { fallbackModels, ...req } = request;
  const modelsToTry = [req.model, ...(fallbackModels ?? [])];

  let lastError: Error | null = null;
  const traceId = crypto.randomUUID();

  for (const model of modelsToTry) {
    const startTime = new Date().toISOString();
    try {
      const response = await fetch(`${env.LITELLM_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
          ...getHeliconeHeaders(),
        },
        body: JSON.stringify({ ...req, model }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        // If this is a model-specific error and we have fallbacks, try the next model
        if (response.status >= 500 && modelsToTry.indexOf(model) < modelsToTry.length - 1) {
          lastError = new Error(`Model ${model} failed (${response.status}): ${errorText}`);
          continue;
        }
        // For streaming, still return the response even on error so caller handles it
        if (req.stream) return response;
        throw new Error(`LLM API error (${response.status}): ${errorText}`);
      }

      // For streaming requests, return the raw Response
      if (req.stream) return response;

      const data = await response.json();
      // Tag the response with the model that actually served it
      if (model !== req.model) {
        data._fallbackModel = model;
        data._originalModel = req.model;
      }
      // Record trace for observability (Story #160)
      traceGeneration({
        traceId,
        model,
        input: req.messages,
        output: data.choices?.[0]?.message,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        startTime,
        endTime: new Date().toISOString(),
      });
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If we have more models to try, continue
      if (modelsToTry.indexOf(model) < modelsToTry.length - 1) continue;
      throw lastError;
    }
  }

  throw lastError ?? new Error("No models available");
}

export async function streamChatCompletion(c: any, request: ChatCompletionRequest) {
  const { fallbackModels, ...req } = request;

  const response = await fetch(`${env.LITELLM_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
    },
    body: JSON.stringify({ ...req, stream: true }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok || !response.body) {
    // Try fallback models for streaming
    if (fallbackModels && fallbackModels.length > 0) {
      for (const fallbackModel of fallbackModels) {
        try {
          const fbResp = await fetch(`${env.LITELLM_API_URL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
            },
            body: JSON.stringify({ ...req, model: fallbackModel, stream: true }),
            signal: AbortSignal.timeout(120_000),
          });

          if (fbResp.ok && fbResp.body) {
            c.header("Content-Type", "text/event-stream");
            c.header("Cache-Control", "no-cache");
            c.header("Connection", "keep-alive");
            c.header("X-Fallback-Model", fallbackModel);
            return new Response(fbResp.body, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Fallback-Model": fallbackModel,
              },
            });
          }
        } catch {
          continue;
        }
      }
    }

    return c.json({ error: "LLM request failed" }, 502);
  }

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export async function listModels(): Promise<unknown> {
  const response = await fetch(`${env.LITELLM_API_URL}/models`, {
    headers: {
      Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  return response.json();
}

export async function generateEmbedding(text: string, model = env.EMBEDDING_MODEL ?? "lmstudio/text-embedding-nomic-embed-text-v1.5"): Promise<number[] | null> {
  try {
    const response = await fetch(`${env.LITELLM_API_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
      },
      body: JSON.stringify({ model, input: [text] }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) return null;

    const data = await response.json() as { data: { embedding: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
