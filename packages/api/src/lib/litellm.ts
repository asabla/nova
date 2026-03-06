import { env } from "./env";

interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: string | object;
}

export async function chatCompletion(request: ChatCompletionRequest): Promise<Response> {
  return fetch(`${env.LITELLM_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
    },
    body: JSON.stringify(request),
  });
}

export async function listModels(): Promise<unknown> {
  const response = await fetch(`${env.LITELLM_API_URL}/models`, {
    headers: {
      Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
    },
  });
  return response.json();
}
