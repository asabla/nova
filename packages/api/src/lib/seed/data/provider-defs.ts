export interface ModelDef {
  name: string;
  modelIdExternal: string;
  capabilities: string[];
  contextWindow: number;
  isDefault?: boolean;
  modelParams: Record<string, unknown> | null;
}

export interface ProviderDef {
  name: string;
  type: "openai" | "anthropic" | "azure" | "ollama" | "custom";
  apiBaseUrl: string;
  apiKey: string;
  models: ModelDef[];
}

export function getProviderDefs(): ProviderDef[] {
  return [
    {
      name: "OpenAI",
      type: "openai",
      apiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY ?? "",
      models: [
        {
          name: "GPT-5.4",
          modelIdExternal: "gpt-5.4",
          capabilities: ["chat", "vision", "reasoning"],
          contextWindow: 128000,
          isDefault: true,
          modelParams: { dropParams: ["temperature", "top_p", "presence_penalty", "frequency_penalty", "logprobs", "top_logprobs", "parallel_tool_calls", "max_tokens"] },
        },
        {
          name: "Text Embedding 3 Small",
          modelIdExternal: "text-embedding-3-small",
          capabilities: ["embeddings"],
          contextWindow: 8192,
          modelParams: null,
        },
      ],
    },
    {
      name: "Anthropic",
      type: "anthropic",
      apiBaseUrl: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1",
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      models: [
        {
          name: "Claude Sonnet 5.6",
          modelIdExternal: "claude-sonnet-5-6",
          capabilities: ["chat", "vision"],
          contextWindow: 200000,
          isDefault: false,
          modelParams: null,
        },
      ],
    },
  ];
}
