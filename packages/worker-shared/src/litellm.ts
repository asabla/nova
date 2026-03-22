import OpenAI from "openai";

export const openai = new OpenAI({
  baseURL: process.env.LITELLM_URL ?? "http://localhost:4000",
  apiKey: process.env.LITELLM_MASTER_KEY ?? "",
  timeout: 120_000,
  maxRetries: 0,
});
