import OpenAI from "openai";
import { publishToken, publishToolStatus as pubToolStatus, publishDone as pubDone, publishError } from "../lib/stream-publisher";
import { openai } from "../lib/litellm";

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
 * Truncate message content to stay within model context limits.
 * Tool results can be very large; cap each message to avoid KV cache crashes.
 */
function truncateMessages(
  messages: { role: string; content: string; [k: string]: unknown }[],
  maxCharsPerMessage = 3000,
  maxTotalChars = 24000,
): { role: string; content: string; [k: string]: unknown }[] {
  const truncated = messages.map((m) => {
    if (typeof m.content === "string" && m.content.length > maxCharsPerMessage) {
      return { ...m, content: m.content.slice(0, maxCharsPerMessage) + "\n...[truncated]" };
    }
    return m;
  });

  // If total is still too large, drop older non-system/non-tool messages
  let total = truncated.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
  if (total > maxTotalChars) {
    // Keep system (first), last 2 user messages, and all tool messages; trim the rest
    const result: typeof truncated = [];
    for (let i = truncated.length - 1; i >= 0; i--) {
      result.unshift(truncated[i]);
      total = result.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
      if (total >= maxTotalChars && i > 0) {
        // Drop this message
        result.shift();
        break;
      }
    }
    return result;
  }

  return truncated;
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
  const safeMessages = truncateMessages(input.messages);

  const params: Record<string, unknown> = {
    model: input.model,
    messages: safeMessages,
    temperature: input.temperature ?? 0.7,
    max_tokens: input.maxTokens ?? 16384,
  };

  if (input.tools && input.tools.length > 0) {
    params.tools = input.tools;
  }

  try {
    const stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> = await openai.chat.completions.create({
      ...params,
      stream: true,
      stream_options: { include_usage: true },
    } as any) as any;

    let fullContent = "";
    let toolCalls: any[] = [];
    let finishReason = "stop";
    let usage: { prompt_tokens?: number; completion_tokens?: number } = {};

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      const choiceFinish = chunk.choices?.[0]?.finish_reason;

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

      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    return { content: fullContent, toolCalls: toolCalls.filter(Boolean), finishReason, usage };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await publishError(input.streamChannelId, `LLM API error: ${errMsg}`);
    throw err;
  }
}
