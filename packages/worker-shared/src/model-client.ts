import OpenAI from "openai";

export interface ResolvedProvider {
  type: "openai" | "anthropic" | "azure" | "ollama" | "custom";
  apiBaseUrl: string | null;
  apiKey: string;
  providerParams?: { defaultHeaders?: Record<string, string> } | null;
}

const clientCache = new Map<string, { client: OpenAI; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function createProviderClient(providerId: string, config: ResolvedProvider): OpenAI {
  const cached = clientCache.get(providerId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.client;

  const providerParams = config.providerParams as { defaultHeaders?: Record<string, string> } | null;

  const client = new OpenAI({
    baseURL: resolveBaseURL(config),
    apiKey: config.apiKey,
    defaultHeaders: providerParams?.defaultHeaders,
    timeout: 120_000,
    maxRetries: 0,
  });

  clientCache.set(providerId, { client, ts: Date.now() });
  return client;
}

function resolveBaseURL(config: ResolvedProvider): string {
  if (config.apiBaseUrl) return config.apiBaseUrl;
  switch (config.type) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1/";
    case "azure":
      // Azure requires apiBaseUrl to be set explicitly
      return "https://api.openai.com/v1";
    case "ollama":
      return "http://localhost:11434/v1";
    case "custom":
    default:
      return "https://api.openai.com/v1";
  }
}

export function clearClientCache(providerId?: string): void {
  if (providerId) clientCache.delete(providerId);
  else clientCache.clear();
}
