/**
 * @deprecated Use `agentWorkflow` with `mode: "chat"` instead.
 * This wrapper exists for backward compatibility with existing workflow references.
 */
import { agentWorkflow } from "./agent.js";
import type { AgentWorkflowResult } from "./agent.js";

export { cancelSignal } from "./agent.js";

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

export async function smartChatWorkflow(input: SmartChatInput): Promise<SmartChatResult> {
  const result = await agentWorkflow({
    mode: "chat",
    orgId: input.orgId,
    userId: "",
    conversationId: input.conversationId,
    streamChannelId: input.streamChannelId,
    workflowId: input.workflowId,
    messageHistory: input.messageHistory,
    pendingToolCalls: input.pendingToolCalls,
    model: input.model,
    modelParams: input.modelParams,
    tools: input.tools,
    maxSteps: input.maxSteps,
  });

  return {
    content: result.content,
    totalTokens: result.totalTokens,
    steps: result.steps,
    status: result.status === "completed" ? "completed" : "cancelled",
    toolCallRecords: result.toolCallRecords,
  };
}
