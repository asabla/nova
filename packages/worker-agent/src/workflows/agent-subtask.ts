import {
  proxyActivities,
  CancellationScope,
  defineSignal,
  setHandler,
} from "@temporalio/workflow";
import type * as agentStepActivities from "../activities/agent-step.activities";
import type * as agentActivities from "../activities/agent-execution.activities";
import type * as streamActivities from "../activities/stream.activities";
import type {
  PlanNode,
  ToolCallRecord,
  UserInteractionRequest,
  UserInteractionResponse,
} from "@nova/shared/types";
const { executeAgentStepWithSDK } = proxyActivities<typeof agentStepActivities>({
  startToCloseTimeout: "3 minutes",
  retry: { maximumAttempts: 3 },
});

const { executeToolCall } = proxyActivities<typeof agentActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 },
});

const {
  publishPlanNodeStatusActivity,
  publishInteractionRequestActivity,
} = proxyActivities<typeof streamActivities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 2 },
});

// --- Signals ---

export const cancelSubtaskSignal = defineSignal("cancel");
export const interactionResponseSignal = defineSignal<[UserInteractionResponse]>("userInteractionResponse");

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
  /** If provided, the subtask executes this sub-plan instead of a single agent loop. */
  subPlan?: PlanNode[];
}

export interface SubtaskResult {
  subtaskId: string;
  content: string;
  toolCallRecords: ToolCallRecord[];
  totalTokens: number;
  status: "completed" | "failed" | "timeout";
}

/**
 * Child workflow for executing a single subtask as part of a larger plan.
 * Supports both simple task execution and nested sub-plan execution.
 */
export async function agentSubtaskWorkflow(input: SubtaskInput): Promise<SubtaskResult> {
  let cancelled = false;
  const interactionResponses = new Map<string, UserInteractionResponse>();

  setHandler(cancelSubtaskSignal, () => { cancelled = true; });
  setHandler(interactionResponseSignal, (response) => {
    interactionResponses.set(response.requestId, response);
  });

  const maxSteps = input.maxSteps ?? 10;
  let totalTokens = 0;
  const toolCallRecords: ToolCallRecord[] = [];
  let finalContent = "";
  let finalStatus: SubtaskResult["status"] = "completed";

  const messageHistory: { role: string; content: string }[] = [
    {
      role: "user",
      content: `Context from parent task:\n${input.context}\n\nYour subtask:\n${input.task}`,
    },
  ];

  const subtaskLoop = async () => {
    let currentStep = 0;

    while (currentStep < maxSteps && !cancelled) {
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
            executeToolCall(input.orgId, input.agentId, tc.id, tc.name, tc.arguments),
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
    await CancellationScope.withTimeout(300_000, subtaskLoop);
  } catch (err: any) {
    if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
      finalStatus = cancelled ? "failed" : "timeout";
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
