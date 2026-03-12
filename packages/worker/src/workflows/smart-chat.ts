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

export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  error?: string;
  durationMs: number;
}

export interface SmartChatResult {
  content: string;
  totalTokens: number;
  steps: number;
  status: "completed" | "cancelled";
  toolCallRecords: ToolCallRecord[];
}

function buildResultSummary(toolName: string, result: { result: unknown; error?: string }): string {
  if (result.error) return `Error: ${result.error.slice(0, 60)}`;
  try {
    const r = result.result;
    if (toolName === "web_search") {
      if (Array.isArray(r)) return `Found ${r.length} result${r.length === 1 ? "" : "s"}`;
      if (typeof r === "object" && r !== null && "results" in r) {
        const arr = (r as any).results;
        if (Array.isArray(arr)) return `Found ${arr.length} result${arr.length === 1 ? "" : "s"}`;
      }
      const str = typeof r === "string" ? r : JSON.stringify(r);
      return `Fetched ${str.length.toLocaleString()} chars`;
    }
    if (toolName === "fetch_url") {
      const str = typeof r === "string" ? r : JSON.stringify(r);
      return `Read ${str.length.toLocaleString()} chars`;
    }
    return "Done";
  } catch {
    return "Done";
  }
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
  const toolCallRecords: ToolCallRecord[] = [];

  const loop = async () => {
    while (steps < maxSteps && !cancelled) {
      steps++;

      // 1. Add assistant message with tool_calls to history (required by OpenAI API format)
      messageHistory.push({
        role: "assistant",
        content: "",
        tool_calls: pendingToolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      } as any);

      // 2. Execute pending tool calls
      for (const tc of pendingToolCalls) {
        if (cancelled) break;

        let parsedArgs: Record<string, unknown> = {};
        try { parsedArgs = JSON.parse(tc.function.arguments); } catch { /* ignore */ }

        await publishToolStatus(input.streamChannelId, tc.function.name, "running", { args: parsedArgs });

        const startMs = Date.now();
        const result = await executeToolCall(
          input.orgId,
          "", // no agentId for smart chat
          tc.id,
          tc.function.name,
          tc.function.arguments,
        );
        const durationMs = Date.now() - startMs;

        const summary = buildResultSummary(tc.function.name, result);
        await publishToolStatus(
          input.streamChannelId,
          tc.function.name,
          result.error ? "error" : "completed",
          { resultSummary: summary },
        );

        toolCallRecords.push({
          toolName: tc.function.name,
          input: parsedArgs,
          output: result.result ?? null,
          error: result.error,
          durationMs,
        });

        messageHistory.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        } as any);
      }

      if (cancelled) break;

      // 3. Call LLM with streaming (tokens published via Redis)
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

      // 4. Check if more tool calls are needed
      if (llmResult.finishReason === "tool_calls" && llmResult.toolCalls.length > 0) {
        pendingToolCalls = llmResult.toolCalls;
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
    toolCallRecords,
  };
}
