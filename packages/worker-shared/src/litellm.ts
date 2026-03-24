import OpenAI from "openai";

/**
 * Fallback global client for dev / cases without org context.
 * Points directly at provider instead of LiteLLM proxy.
 * Prefer resolveModelClient(orgId) for proper multi-tenant isolation.
 */
export const openai = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY ?? "",
  timeout: 120_000,
  maxRetries: 0,
});

export { resolveModelClient } from "./models";
