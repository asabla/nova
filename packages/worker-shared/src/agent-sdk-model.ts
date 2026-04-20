import { OpenAIChatCompletionsModel } from "@openai/agents-openai";
import { setOpenAIAPI } from "@openai/agents";
import type { ModelProvider, Model } from "@openai/agents-core";
import type OpenAI from "openai";
import { openai } from "./litellm.js";

// Use Chat Completions API (not Responses API) since we call /chat/completions directly
setOpenAIAPI("chat_completions");

/**
 * ModelProvider that wraps an OpenAI client for use with the Agent SDK.
 * Accepts a client instance to support per-org provider resolution.
 */
export class NovaModelProvider implements ModelProvider {
  private client: OpenAI;

  constructor(client?: OpenAI) {
    this.client = client ?? openai;
  }

  getModel(modelName?: string): Model {
    return new OpenAIChatCompletionsModel(
      this.client as any,
      modelName ?? "gpt-5.4",
    );
  }
}

/** Default provider using the global fallback client */
export const defaultModelProvider = new NovaModelProvider();

/** Create a model provider for a specific OpenAI client (org-aware) */
export function createModelProvider(client: OpenAI): NovaModelProvider {
  return new NovaModelProvider(client);
}

/** Create a model instance for a specific model ID */
export function createModel(modelId: string, client?: OpenAI): Model {
  return new OpenAIChatCompletionsModel((client ?? openai) as any, modelId);
}

// Backward compat aliases
export { NovaModelProvider as LiteLLMModelProvider };
export const litellmModelProvider = defaultModelProvider;
export function createLiteLLMModel(modelId: string): Model {
  return createModel(modelId);
}
