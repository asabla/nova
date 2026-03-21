import type {
  ExecutionTier,
  Plan,
  PlanNodeStatus,
  UserInteractionRequest,
  UserInteractionResponse,
} from "./agent-flow";

export type SSEEvent =
  // --- Streaming ---
  | { event: "token"; data: { content: string } }
  | { event: "tool_call"; data: { id: string; name: string; arguments: string } }
  | { event: "tool_result"; data: { id: string; result: unknown } }
  | { event: "approval_required"; data: { toolCallId: string; name: string; args: unknown } }
  | { event: "error"; data: { message: string; code: string } }
  | { event: "done"; data: "" }
  | { event: "heartbeat"; data: "" }
  // --- Agent flow: tier & plan ---
  | { event: "tier.assessed"; data: { tier: ExecutionTier; reasoning: string } }
  | { event: "plan.generated"; data: { plan: Plan } }
  | { event: "plan.approved"; data: { planId: string } }
  | { event: "plan.node.status"; data: { nodeId: string; status: PlanNodeStatus; detail?: string } }
  // --- Agent flow: user interaction ---
  | { event: "interaction.request"; data: UserInteractionRequest }
  | { event: "interaction.response"; data: UserInteractionResponse }
  // --- Agent flow: subtasks ---
  | { event: "subtask.spawned"; data: { subtaskId: string; description: string; nodeId: string } }
  | { event: "subtask.complete"; data: { subtaskId: string; summary: string; status: string } }
  // --- Research ---
  | { event: "research.version.created"; data: { versionId: string; version: number } };
