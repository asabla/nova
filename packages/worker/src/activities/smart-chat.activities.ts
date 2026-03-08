import { publishToken, publishToolStatus as pubToolStatus, publishDone as pubDone, publishError } from "../lib/stream-publisher";
import { LITELLM_URL, litellmHeaders } from "../lib/litellm";

// Re-export stream-publisher functions as activities so the workflow can call them
export async function publishToolStatus(
  channelId: string,
  tool: string,
  status: "running" | "completed" | "error",
) {
  await pubToolStatus(channelId, tool, status);
}

export async function publishDone(
  channelId: string,
  result: { content: string; usage: { prompt_tokens?: number; completion_tokens?: number } },
) {
  await pubDone(channelId, result);
}

/**
 * Streaming LLM step: calls LiteLLM with streaming, publishes each token
 * to Redis, and returns the accumulated response with any tool calls.
 */
export async function streamingLLMStep(input: {
  streamChannelId: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
}): Promise<{
  content: string;
  toolCalls: any[];
  finishReason: string;
  usage: { prompt_tokens?: number; completion_tokens?: number };
}> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    stream: true,
    temperature: input.temperature ?? 0.7,
    max_tokens: input.maxTokens ?? 4096,
  };

  if (input.tools && input.tools.length > 0) {
    body.tools = input.tools;
  }

  const resp = await fetch(`${LITELLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: litellmHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    await publishError(input.streamChannelId, `LLM API error: ${resp.status} ${errText}`);
    throw new Error(`LLM API error: ${resp.status} ${errText}`);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let toolCalls: any[] = [];
  let finishReason = "stop";
  let usage: { prompt_tokens?: number; completion_tokens?: number } = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;

      try {
        const data = JSON.parse(line.slice(6));
        const delta = data.choices?.[0]?.delta;
        const choiceFinish = data.choices?.[0]?.finish_reason;

        if (delta?.content) {
          fullContent += delta.content;
          await publishToken(input.streamChannelId, delta.content);
        }

        // Accumulate tool calls from deltas
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: tc.id ?? "", function: { name: "", arguments: "" } };
            }
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }

        if (choiceFinish) {
          finishReason = choiceFinish;
        }

        if (data.usage) {
          usage = data.usage;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  return { content: fullContent, toolCalls: toolCalls.filter(Boolean), finishReason, usage };
}
