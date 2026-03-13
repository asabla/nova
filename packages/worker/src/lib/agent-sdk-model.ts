import { OpenAIChatCompletionsModel } from "@openai/agents-openai";
import { setOpenAIAPI } from "@openai/agents";
import type { ModelProvider, Model } from "@openai/agents-core";
import { openai } from "./litellm";

// Use Chat Completions API (not Responses API) since LiteLLM proxies the /chat/completions endpoint
setOpenAIAPI("chat_completions");

/**
 * ModelProvider that wraps our existing LiteLLM-pointed OpenAI client.
 * The OpenAIChatCompletionsModel accepts a standard OpenAI client instance,
 * so no custom Model implementation is needed.
 */
export class LiteLLMModelProvider implements ModelProvider {
  getModel(modelName?: string): Model {
    return new OpenAIChatCompletionsModel(
      openai as any,
      modelName ?? "default-model",
    );
  }
}

/** Singleton provider instance for reuse across agent runs */
export const litellmModelProvider = new LiteLLMModelProvider();

/** Create a model instance for a specific LiteLLM model ID */
export function createLiteLLMModel(modelId: string): Model {
  return new OpenAIChatCompletionsModel(openai as any, modelId);
}
