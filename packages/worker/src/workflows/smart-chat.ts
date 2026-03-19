import { proxyActivities, defineSignal, setHandler, CancellationScope } from "@temporalio/workflow";
import type * as agentRunActivities from "../activities/agent-run.activities";
import type * as smartChatActivities from "../activities/smart-chat.activities";

const { runAgentLoop } = proxyActivities<typeof agentRunActivities>({
  // Longer timeout: the SDK runs the full tool-call loop inside one activity
  startToCloseTimeout: "3 minutes",
  heartbeatTimeout: "30 seconds",
  retry: { maximumAttempts: 2 },
});

// Keep publishDone for the cancellation path where the SDK loop didn't complete
const { publishDone, updateWorkflowStatus } = proxyActivities<typeof smartChatActivities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 2 },
});

export const cancelSignal = defineSignal("cancel");

export interface SmartChatInput {
  orgId: string;
  conversationId: string;
  streamChannelId: string;
  workflowId?: string;
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

/**
 * Smart chat workflow — now delegates the LLM tool-call loop to the
 * OpenAI Agent SDK via the `runAgentLoop` activity.
 *
 * Temporal remains the outer shell for:
 * - Cancellation signals
 * - Timeout enforcement
 * - Durability (activity retries)
 *
 * The Agent SDK handles:
 * - The tool-call loop (call LLM → detect tool_calls → execute → repeat)
 * - Tool execution with Zod-validated inputs
 * - Streaming token events (published to Redis inside the activity)
 */
export async function smartChatWorkflow(input: SmartChatInput): Promise<SmartChatResult> {
  let cancelled = false;
  setHandler(cancelSignal, () => { cancelled = true; });

  // Track workflow status in DB if workflowId is provided
  if (input.workflowId) {
    await updateWorkflowStatus(input.workflowId, "running");
  }

  // If we have pending tool calls from the initial API-side LLM call,
  // prepend them as tool-result messages so the SDK picks up from where the API left off.
  const messageHistory = [...input.messageHistory];
  if (input.pendingToolCalls.length > 0) {
    // The API already detected tool_calls on the first LLM response.
    // Add the assistant message with tool_calls so the history is well-formed,
    // then add placeholder tool results to trigger re-execution by the SDK.
    messageHistory.push({
      role: "assistant",
      content: "",
      tool_calls: input.pendingToolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    } as any);

    // Add empty tool results so the SDK knows these tools need to be re-called
    for (const tc of input.pendingToolCalls) {
      messageHistory.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify({ status: "pending", message: "Tool execution was deferred to workflow" }),
      } as any);
    }
  }

  let result: SmartChatResult = {
    content: "",
    totalTokens: 0,
    steps: 0,
    status: "completed",
    toolCallRecords: [],
  };

  const loop = async () => {
    if (cancelled) return;

    const agentResult = await runAgentLoop({
      streamChannelId: input.streamChannelId,
      model: input.model,
      systemPrompt: messageHistory.find((m) => m.role === "system")?.content,
      messageHistory: messageHistory.filter((m) => m.role !== "system"),
      temperature: input.modelParams?.temperature,
      maxTokens: input.modelParams?.maxTokens,
      maxTurns: input.maxSteps ?? 5,
    });

    result = {
      content: agentResult.content,
      totalTokens: agentResult.totalTokens,
      steps: agentResult.steps,
      status: "completed",
      toolCallRecords: agentResult.toolCallRecords,
    };
  };

  try {
    await CancellationScope.withTimeout(120_000, loop);
  } catch (err: any) {
    if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
      const isTimeout = err.message?.includes("timed out") && !cancelled;
      cancelled = true;
      result.status = "cancelled";

      // Signal completion to the relay so the frontend knows to stop waiting
      await publishDone(input.streamChannelId, {
        content: result.content,
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      });

      if (input.workflowId) {
        await updateWorkflowStatus(input.workflowId, isTimeout ? "timeout" : "cancelled");
      }
    } else {
      if (input.workflowId) {
        await updateWorkflowStatus(input.workflowId, "error", {
          errorMessage: err.message ?? String(err),
        });
      }
      throw err;
    }
  }

  if (input.workflowId) {
    await updateWorkflowStatus(input.workflowId, "completed", {
      output: { content: result.content, totalTokens: result.totalTokens, steps: result.steps },
    });
  }

  return result;
}
