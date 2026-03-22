/**
 * @deprecated Use `agentWorkflow` directly instead.
 * This wrapper exists for backward compatibility with existing workflow references
 * (scheduler, cron triggers).
 */
import { agentWorkflow } from "./agent.js";
import type { AgentWorkflowResult } from "@nova/shared/types";

export { cancelSignal, userInputSignal, toolApprovalSignal, statusQuery } from "./agent.js";

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

export async function agentExecutionWorkflow(input: AgentExecutionInput): Promise<AgentExecutionResult> {
  const result = await agentWorkflow({
    orgId: input.orgId,
    userId: input.userId,
    agentId: input.agentId,
    conversationId: input.conversationId ?? "",
    workflowId: input.workflowId,
    userMessage: input.userMessage,
    model: "", // Will be resolved from agent config
    maxSteps: input.maxSteps,
    timeoutSeconds: input.timeoutSeconds,
  });

  return {
    conversationId: result.conversationId,
    messageIds: result.messageIds,
    totalTokens: result.totalTokens,
    steps: result.steps,
    status: result.status === "awaiting_approval" ? "awaiting_input" : result.status,
  };
}
