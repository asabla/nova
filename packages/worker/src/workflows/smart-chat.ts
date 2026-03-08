import { proxyActivities, defineSignal, setHandler, CancellationScope } from "@temporalio/workflow";
import type * as smartChatActivities from "../activities/smart-chat.activities";
import type * as agentActivities from "../activities/agent-execution.activities";

const {
  streamingLLMStep,
  publishToolStatus,
  publishDone,
} = proxyActivities<typeof smartChatActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 2 },
});

const { executeToolCall } = proxyActivities<typeof agentActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 },
});

export const cancelSignal = defineSignal("cancel");

export interface SmartChatInput {
  orgId: string;
  conversationId: string;
  streamChannelId: string;
  messageHistory: { role: string; content: string }[];
  pendingToolCalls: { id: string; function: { name: string; arguments: string } }[];
  model: string;
  modelParams?: { temperature?: number; maxTokens?: number };
  tools?: unknown[];
  maxSteps?: number;
}

export interface SmartChatResult {
  content: string;
  totalTokens: number;
  steps: number;
  status: "completed" | "cancelled";
}

export async function smartChatWorkflow(input: SmartChatInput): Promise<SmartChatResult> {
  let cancelled = false;
  setHandler(cancelSignal, () => { cancelled = true; });

  const maxSteps = input.maxSteps ?? 5;
  let totalTokens = 0;
  let steps = 0;
  let lastContent = "";
  let pendingToolCalls = input.pendingToolCalls;
  const messageHistory = [...input.messageHistory];

  const loop = async () => {
    while (steps < maxSteps && !cancelled) {
      steps++;

      // 1. Execute pending tool calls
      for (const tc of pendingToolCalls) {
        if (cancelled) break;

        await publishToolStatus(input.streamChannelId, tc.function.name, "running");

        const result = await executeToolCall(
          input.orgId,
          "", // no agentId for smart chat
          tc.id,
          tc.function.name,
          tc.function.arguments,
        );

        await publishToolStatus(input.streamChannelId, tc.function.name, result.error ? "error" : "completed");

        messageHistory.push({
          role: "tool",
          content: JSON.stringify(result),
        });
      }

      if (cancelled) break;

      // 2. Call LLM with streaming (tokens published via Redis)
      const llmResult = await streamingLLMStep({
        streamChannelId: input.streamChannelId,
        model: input.model,
        messages: messageHistory,
        temperature: input.modelParams?.temperature,
        maxTokens: input.modelParams?.maxTokens,
        tools: input.tools,
      });

      totalTokens += (llmResult.usage.prompt_tokens ?? 0) + (llmResult.usage.completion_tokens ?? 0);
      lastContent = llmResult.content;

      if (llmResult.content) {
        messageHistory.push({ role: "assistant", content: llmResult.content });
      }

      // 3. Check if more tool calls are needed
      if (llmResult.finishReason === "tool_calls" && llmResult.toolCalls.length > 0) {
        pendingToolCalls = llmResult.toolCalls;
        // Add the assistant message with tool_calls to history for proper API format
        continue;
      }

      // Done - no more tool calls
      break;
    }
  };

  try {
    await CancellationScope.withTimeout(120_000, loop);
  } catch (err: any) {
    if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
      cancelled = true;
    } else {
      throw err;
    }
  }

  // Signal completion to the relay
  await publishDone(input.streamChannelId, {
    content: lastContent,
    usage: { prompt_tokens: 0, completion_tokens: 0 },
  });

  return {
    content: lastContent,
    totalTokens,
    steps,
    status: cancelled ? "cancelled" : "completed",
  };
}
