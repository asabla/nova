import { proxyActivities, defineSignal, defineQuery, setHandler, sleep, condition, CancellationScope } from "@temporalio/workflow";
import type * as agentActivities from "../activities/agent-execution.activities";
import type * as agentStepActivities from "../activities/agent-step.activities";
import type * as smartChatActivities from "../activities/smart-chat.activities";

const {
  getAgentConfig,
  loadAgentMemory,
  saveAgentMemory,
  saveAgentMessage,
  createAgentConversation,
  executeToolCall,
  notifyAgentCompletion,
} = proxyActivities<typeof agentActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 },
});

const { executeAgentStepWithSDK } = proxyActivities<typeof agentStepActivities>({
  startToCloseTimeout: "2 minutes",
  heartbeatTimeout: "30 seconds",
  retry: { maximumAttempts: 3 },
});

const { updateWorkflowStatus } = proxyActivities<typeof smartChatActivities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 2 },
});

export interface AgentExecutionInput {
  orgId: string;
  userId: string;
  agentId: string;
  conversationId?: string;
  workflowId?: string;
  userMessage: string;
  maxSteps?: number;
  timeoutSeconds?: number;
}

export interface AgentExecutionResult {
  conversationId: string;
  messageIds: string[];
  totalTokens: number;
  steps: number;
  status: "completed" | "cancelled" | "timeout" | "max_steps" | "awaiting_input";
}

// Signals
export const cancelSignal = defineSignal("cancel");
export const userInputSignal = defineSignal<[string]>("userInput");
export const toolApprovalSignal = defineSignal<[{ toolCallId: string; approved: boolean }]>("toolApproval");

// Queries
export const statusQuery = defineQuery<{ step: number; status: string; pendingToolCalls: string[] }>("status");

export async function agentExecutionWorkflow(input: AgentExecutionInput): Promise<AgentExecutionResult> {
  let cancelled = false;
  let userInputReceived: string | null = null;
  let pendingToolApprovals: Map<string, boolean> = new Map();
  let currentStep = 0;
  let currentStatus = "running";
  let pendingToolCallIds: string[] = [];

  // Signal handlers
  setHandler(cancelSignal, () => { cancelled = true; });
  setHandler(userInputSignal, (input: string) => { userInputReceived = input; });
  setHandler(toolApprovalSignal, (approval: { toolCallId: string; approved: boolean }) => {
    pendingToolApprovals.set(approval.toolCallId, approval.approved);
  });

  // Query handler
  setHandler(statusQuery, () => ({
    step: currentStep,
    status: currentStatus,
    pendingToolCalls: pendingToolCallIds,
  }));

  // Track workflow status
  if (input.workflowId) {
    await updateWorkflowStatus(input.workflowId, "running");
  }

  // 1. Load agent config
  const agent = await getAgentConfig(input.orgId, input.agentId);

  // Use agent-configured limits, with input overrides, then defaults
  const maxSteps = input.maxSteps ?? agent.maxSteps ?? 25;
  const timeoutSeconds = input.timeoutSeconds ?? agent.timeoutSeconds ?? 300;

  // 2. Load agent memory
  const memory = await loadAgentMemory(
    input.agentId,
    agent.memoryScope,
    agent.memoryScope === "per-user" ? input.userId : undefined,
  );

  // 3. Create or use conversation
  let conversationId = input.conversationId;
  if (!conversationId) {
    const conv = await createAgentConversation(
      input.orgId,
      input.userId,
      input.agentId,
      `Agent: ${agent.name}`,
    );
    conversationId = conv.id;
  }

  // 4. Build initial message history
  const messageHistory: { role: string; content: string }[] = [];

  if (Object.keys(memory).length > 0) {
    messageHistory.push({
      role: "system",
      content: `Agent memory:\n${JSON.stringify(memory, null, 2)}`,
    });
  }

  messageHistory.push({ role: "user", content: input.userMessage });

  // 5. Agent loop with timeout enforcement (Story #57)
  const messageIds: string[] = [];
  let totalTokens = 0;
  let finalStatus: AgentExecutionResult["status"] = "completed";

  const agentLoop = async () => {
    while (currentStep < maxSteps && !cancelled) {
      currentStep++;

      const result = await executeAgentStepWithSDK({
        systemPrompt: agent.systemPrompt,
        modelId: agent.modelId ?? "default-model",
        modelParams: agent.modelParams,
        messageHistory,
        agentId: input.agentId,
        singleTurn: true, // Workflow handles tool approval between turns
      });

      totalTokens += (result.usage.prompt_tokens ?? 0) + (result.usage.completion_tokens ?? 0);

      // Save assistant message
      if (result.content) {
        const msg = await saveAgentMessage(
          input.orgId,
          conversationId!,
          result.content,
          input.agentId,
          agent.modelId,
          result.usage.prompt_tokens,
          result.usage.completion_tokens,
        );
        messageIds.push(msg.id);
        messageHistory.push({ role: "assistant", content: result.content });
      }

      // Check if agent is requesting user input (Story #53)
      if (result.toolCalls.some(
        (tc) => tc.name === "__request_user_input"
      )) {
        currentStatus = "awaiting_input";
        const inputRequest = result.toolCalls.find(
          (tc) => tc.name === "__request_user_input"
        );
        const prompt = inputRequest?.arguments
          ? JSON.parse(inputRequest.arguments).prompt ?? "Please provide input:"
          : "Please provide input:";

        // Save the input request as a message
        await saveAgentMessage(
          input.orgId,
          conversationId!,
          prompt,
          input.agentId,
          agent.modelId,
          0,
          0,
        );

        // Wait for user input signal (up to 10 minutes)
        const gotInput = await condition(() => userInputReceived !== null || cancelled, "10 minutes");
        if (!gotInput || cancelled) {
          finalStatus = cancelled ? "cancelled" : "timeout";
          break;
        }

        messageHistory.push({ role: "user", content: userInputReceived! });
        userInputReceived = null;
        currentStatus = "running";
        continue;
      }

      // Handle tool calls with approval mode (Story #54)
      if (result.toolCalls.length > 0) {
        const toolApprovalMode = agent.toolApprovalMode ?? "auto";

        for (const toolCall of result.toolCalls) {
          let approved = true;

          if (toolApprovalMode === "always-ask") {
            // Wait for approval signal
            pendingToolCallIds.push(toolCall.id);
            currentStatus = "awaiting_approval";

            const gotApproval = await condition(
              () => pendingToolApprovals.has(toolCall.id) || cancelled,
              "5 minutes",
            );

            if (!gotApproval || cancelled) {
              finalStatus = cancelled ? "cancelled" : "timeout";
              pendingToolCallIds = [];
              break;
            }

            approved = pendingToolApprovals.get(toolCall.id) ?? false;
            pendingToolApprovals.delete(toolCall.id);
            pendingToolCallIds = pendingToolCallIds.filter((id) => id !== toolCall.id);
            currentStatus = "running";
          }

          if (approved) {
            const toolResult = await executeToolCall(
              input.orgId,
              input.agentId,
              toolCall.id,
              toolCall.name,
              toolCall.arguments,
            );
            messageHistory.push({
              role: "tool",
              content: JSON.stringify(toolResult),
            });
          } else {
            messageHistory.push({
              role: "tool",
              content: JSON.stringify({ error: "Tool call rejected by user" }),
            });
          }
        }

        if (finalStatus !== "completed") break;
        continue;
      }

      // No tool calls = agent is done
      if (result.finishReason === "stop") break;
    }

    if (cancelled) finalStatus = "cancelled";
    else if (currentStep >= maxSteps && finalStatus === "completed") finalStatus = "max_steps";
  };

  // Run agent loop within a cancellation scope with timeout (Story #57)
  try {
    await CancellationScope.withTimeout(timeoutSeconds * 1000, agentLoop);
  } catch (err: any) {
    if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
      finalStatus = cancelled ? "cancelled" : "timeout";
    } else {
      if (input.workflowId) {
        await updateWorkflowStatus(input.workflowId, "error", {
          errorMessage: err.message ?? String(err),
        });
      }
      throw err;
    }
  }

  // Map terminal status to WorkflowStatus for DB tracking
  if (input.workflowId) {
    const fs = finalStatus as string;
    const dbStatus = fs === "max_steps" ? "completed" as const // max_steps is a form of completion
      : fs === "awaiting_input" ? "waiting_input" as const
      : fs === "timeout" ? "timeout" as const
      : fs === "cancelled" ? "cancelled" as const
      : "completed" as const;
    await updateWorkflowStatus(input.workflowId, dbStatus, {
      output: { steps: currentStep, totalTokens, messageIds, terminalReason: finalStatus },
    });
  }

  // 6. Save updated memory
  const memoryUpdates: Record<string, unknown> = {
    lastInteraction: new Date().toISOString(),
    lastConversationId: conversationId,
  };
  await saveAgentMemory(input.agentId, input.orgId, agent.memoryScope, memoryUpdates, input.userId);

  // 7. Send completion notification (Story #164)
  await notifyAgentCompletion(
    input.orgId,
    input.userId,
    input.agentId,
    conversationId!,
    { steps: currentStep, totalTokens, messageIds },
  );

  return {
    conversationId: conversationId!,
    messageIds,
    totalTokens,
    steps: currentStep,
    status: finalStatus,
  };
}
