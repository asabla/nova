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

export async function chatCompletion(request: ChatCompletionRequest) {
  const response = await fetch(`${env.LITELLM_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
    },
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function streamChatCompletion(c: any, request: ChatCompletionRequest) {
  const response = await fetch(`${env.LITELLM_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
    },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok || !response.body) {
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
  });
  return response.json();
}
