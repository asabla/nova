import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { AppContext } from "../types/context";
import { streamChatCompletion } from "../lib/litellm";
import { DEFAULTS } from "@nova/shared/constants";

const modelCompareRoutes = new Hono<AppContext>();

const compareSchema = z.object({
  prompt: z.string().min(1),
  models: z.array(z.string().min(1)).min(2).max(4),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});

modelCompareRoutes.post("/", zValidator("json", compareSchema), async (c) => {
  const body = c.req.valid("json");

  return streamSSE(c, async (stream) => {
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: "heartbeat", data: "" });
    }, DEFAULTS.SSE_HEARTBEAT_INTERVAL_MS);

    try {
      const startTimes = new Map<string, number>();

      const modelStreams = body.models.map(async (modelId) => {
        startTimes.set(modelId, Date.now());
        let fullContent = "";
        let promptTokens = 0;
        let completionTokens = 0;

        try {
          const llmStream = await streamChatCompletion({
            model: modelId,
            messages: [{ role: "user", content: body.prompt }],
            temperature: body.temperature,
            max_tokens: body.maxTokens,
          });

          for await (const chunk of llmStream) {
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) {
              fullContent += token;
              await stream.writeSSE({
                event: "token",
                data: JSON.stringify({ modelId, content: token }),
              });
            }
            // Capture usage if present (arrives in the final chunk)
            if (chunk.usage) {
              promptTokens = chunk.usage.prompt_tokens ?? 0;
              completionTokens = chunk.usage.completion_tokens ?? 0;
            }
          }

          const elapsed = Date.now() - (startTimes.get(modelId) ?? Date.now());

          await stream.writeSSE({
            event: "model-done",
            data: JSON.stringify({
              modelId,
              content: fullContent,
              responseTimeMs: elapsed,
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            }),
          });
        } catch (err) {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              modelId,
              message: err instanceof Error ? err.message : "Stream error",
            }),
          });
        }
      });

      await Promise.all(modelStreams);
      await stream.writeSSE({ event: "done", data: "" });
    } catch (err) {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          message: err instanceof Error ? err.message : "Comparison error",
        }),
      });
    } finally {
      clearInterval(heartbeat);
    }
  });
});

export { modelCompareRoutes };
