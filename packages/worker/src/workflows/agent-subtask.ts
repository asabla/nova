import { proxyActivities, CancellationScope } from "@temporalio/workflow";
import type * as agentStepActivities from "../activities/agent-step.activities";
import type * as agentActivities from "../activities/agent-execution.activities";
import type * as smartChatActivities from "../activities/smart-chat.activities";

const { executeAgentStepWithSDK } = proxyActivities<typeof agentStepActivities>({
  startToCloseTimeout: "2 minutes",
  heartbeatTimeout: "30 seconds",
  retry: { maximumAttempts: 3 },
});

const { executeToolCall } = proxyActivities<typeof agentActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 },
});

const { publishDone } = proxyActivities<typeof smartChatActivities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 2 },
});

// --- Types ---

export interface SubtaskInput {
  parentWorkflowId: string;
  subtaskId: string;
  orgId: string;
  userId: string;
  agentId: string;
  conversationId: string;
  streamChannelId: string;
  task: string;
  context: string;
  systemPrompt?: string;
  tools?: string[];
  model: string;
  modelParams?: { temperature?: number; maxTokens?: number };
  maxSteps?: number;
}

export interface SubtaskResult {
  subtaskId: string;
  content: string;
  toolCallRecords: ToolCallRecord[];
  totalTokens: number;
  status: "completed" | "failed" | "timeout";
}

interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  error?: string;
  durationMs: number;
}

/**
 * Child workflow for executing a single subtask as part of a larger plan.
 * Runs a focused agent loop with a specific task and context from the parent.
 */
export async function agentSubtaskWorkflow(input: SubtaskInput): Promise<SubtaskResult> {
  const maxSteps = input.maxSteps ?? 10;
  let totalTokens = 0;
  let currentStep = 0;
  const toolCallRecords: ToolCallRecord[] = [];

  const messageHistory: { role: string; content: string }[] = [
    {
      role: "user",
      content: `Context from parent task:\n${input.context}\n\nYour subtask:\n${input.task}`,
    },
  ];

  let finalContent = "";
  let finalStatus: SubtaskResult["status"] = "completed";

  const subtaskLoop = async () => {
    while (currentStep < maxSteps) {
      currentStep++;

      const result = await executeAgentStepWithSDK({
        systemPrompt: input.systemPrompt ?? "You are a focused assistant completing a specific subtask. Be concise and direct.",
        modelId: input.model,
        modelParams: input.modelParams ?? {},
        messageHistory,
        agentId: input.agentId,
        singleTurn: true,
      });

      totalTokens += (result.usage.prompt_tokens ?? 0) + (result.usage.completion_tokens ?? 0);

      if (result.content) {
        finalContent = result.content;
        messageHistory.push({ role: "assistant", content: result.content });
      }

      // Handle tool calls (auto-approve in subtasks)
      if (result.toolCalls.length > 0) {
        const startTime = Date.now();
        const results = await Promise.all(
          result.toolCalls.map((tc) =>
            executeToolCall(input.orgId, input.agentId, tc.id, tc.name, tc.arguments)
          ),
        );
        const durationMs = Date.now() - startTime;

        for (let i = 0; i < result.toolCalls.length; i++) {
          const tc = result.toolCalls[i];
          const toolResult = results[i];
          const contextContent = toolResult.success
            ? `[${tc.name}] ${toolResult.summary}\n${JSON.stringify(toolResult.data)}`
            : `[${tc.name}] Error: ${toolResult.error}`;
          messageHistory.push({ role: "tool", content: contextContent });
          toolCallRecords.push({
            toolName: tc.name,
            input: JSON.parse(tc.arguments || "{}"),
            output: toolResult.data,
            error: toolResult.error,
            durationMs,
          });
        }
        continue;
      }

      // No tool calls = subtask is done
      if (result.finishReason === "stop") break;
    }
  };

  try {
    await CancellationScope.withTimeout(120_000, subtaskLoop);
  } catch (err: any) {
    if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
      finalStatus = "timeout";
    } else {
      finalStatus = "failed";
      finalContent = `Subtask failed: ${err.message ?? String(err)}`;
    }
  }

  return {
    subtaskId: input.subtaskId,
    content: finalContent,
    toolCallRecords,
    totalTokens,
    status: finalStatus,
  };
}
