import type { Model } from "@openai/agents-core";
import type OpenAI from "openai";
import { logger } from "./logger.js";

/**
 * Creates an Agent SDK Model that strips unsupported params from API requests.
 *
 * The Agent SDK's OpenAIChatCompletionsModel always includes max_tokens,
 * temperature, etc. in the request object — even when undefined.
 * OpenAI's API rejects these keys entirely for reasoning models (o1, o3, gpt-5.4).
 *
 * This function wraps the OpenAI client with a proxy that removes the
 * offending keys from chat.completions.create() calls before they're sent.
 */
export async function createReasoningModel(
  client: OpenAI,
  modelName: string,
  dropParams: string[],
): Promise<Model> {
  const { OpenAIChatCompletionsModel } = await import("@openai/agents-openai");
  const wrapped = wrapClientWithParamFilter(client, dropParams);
  return new OpenAIChatCompletionsModel(wrapped as any, modelName);
}

/**
 * Wraps an OpenAI client to strip specified params from chat.completions.create() calls.
 * Exported for testing.
 */
export function wrapClientWithParamFilter(client: OpenAI, dropParams: string[]): OpenAI {
  if (dropParams.length === 0) return client;

  const paramSet = new Set(dropParams);
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);

  const interceptedCreate = function (params: any, ...rest: any[]) {
    const cleaned = { ...params };
    // Convert max_tokens → max_completion_tokens for reasoning models
    // (OpenAI reasoning models reject max_tokens but accept max_completion_tokens)
    if (paramSet.has("max_tokens") && cleaned.max_tokens != null) {
      cleaned.max_completion_tokens = cleaned.max_tokens;
    }
    for (const p of paramSet) {
      delete cleaned[p];
    }
    logger.info({ model: cleaned.model, maxCompletionTokens: cleaned.max_completion_tokens, dropped: dropParams }, "[reasoning-model] API params");
    return originalCreate(cleaned, ...rest);
  };

  return new Proxy(client, {
    get(target, prop) {
      if (prop === "chat") {
        return new Proxy(target.chat, {
          get(chatTarget, chatProp) {
            if (chatProp === "completions") {
              return new Proxy(chatTarget.completions, {
                get(compTarget, compProp) {
                  if (compProp === "create") return interceptedCreate;
                  return (compTarget as any)[compProp];
                },
              });
            }
            return (chatTarget as any)[chatProp];
          },
        });
      }
      return (target as any)[prop];
    },
  });
}
