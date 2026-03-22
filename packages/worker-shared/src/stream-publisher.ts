import type { ResearchProgressType, ResearchStatus, ToolCallStatus } from "@nova/shared/constants";
import type {
  ExecutionTier,
  Plan,
  PlanNodeStatus,
  UserInteractionRequest,
  UserInteractionResponse,
} from "@nova/shared/types";
import { redis } from "./redis";

export async function publishToken(channelId: string, token: string) {
  await redis.publish(channelId, JSON.stringify({ type: "token", content: token }));
}

export async function publishToolStatus(
  channelId: string,
  tool: string,
  status: ToolCallStatus,
  extra?: { args?: Record<string, unknown>; resultSummary?: string },
) {
  await redis.publish(channelId, JSON.stringify({ type: "tool_status", tool, status, ...extra }));
}

export async function publishDone(
  channelId: string,
  result: { content: string; usage: { prompt_tokens?: number; completion_tokens?: number } },
) {
  await redis.publish(channelId, JSON.stringify({ type: "done", ...result }));
}

export async function publishError(channelId: string, message: string) {
  await redis.publish(channelId, JSON.stringify({ type: "error", message }));
}

// --- Research progress publishers ---

export async function publishResearchStatus(
  channelId: string,
  status: ResearchStatus,
  phase?: string,
) {
  await redis.publish(channelId, JSON.stringify({
    type: "research.status",
    status,
    phase,
  }));
}

export async function publishResearchSource(
  channelId: string,
  source: { title: string; url: string; relevance?: number },
) {
  await redis.publish(channelId, JSON.stringify({
    type: "research.source",
    ...source,
  }));
}

export async function publishResearchProgress(
  channelId: string,
  progressType: ResearchProgressType,
  message: string,
  extra?: { sourceUrl?: string },
) {
  await redis.publish(channelId, JSON.stringify({
    type: "research.progress",
    progressType,
    message,
    ...extra,
  }));
}

export async function publishResearchDone(
  channelId: string,
  data: { reportId: string; sourcesCount: number },
) {
  await redis.publish(channelId, JSON.stringify({
    type: "research.done",
    ...data,
  }));
}

export async function publishResearchError(channelId: string, message: string) {
  await redis.publish(channelId, JSON.stringify({
    type: "research.error",
    message,
  }));
}

// --- Agent flow: tier & plan publishers ---

export async function publishTierAssessed(
  channelId: string,
  data: { tier: ExecutionTier; reasoning: string },
) {
  await redis.publish(channelId, JSON.stringify({ type: "tier.assessed", ...data }));
}

export async function publishPlanGeneratedV2(
  channelId: string,
  plan: Plan,
) {
  await redis.publish(channelId, JSON.stringify({ type: "plan.generated", plan }));
}

export async function publishPlanApproved(
  channelId: string,
  planId: string,
) {
  await redis.publish(channelId, JSON.stringify({ type: "plan.approved", planId }));
}

export async function publishPlanNodeStatus(
  channelId: string,
  data: { nodeId: string; status: PlanNodeStatus; detail?: string },
) {
  await redis.publish(channelId, JSON.stringify({ type: "plan.node.status", ...data }));
}

// --- Agent flow: user interaction publishers ---

export async function publishInteractionRequest(
  channelId: string,
  request: UserInteractionRequest,
) {
  await redis.publish(channelId, JSON.stringify({ type: "interaction.request", request }));
}

export async function publishInteractionResponse(
  channelId: string,
  response: UserInteractionResponse,
) {
  await redis.publish(channelId, JSON.stringify({ type: "interaction.response", response }));
}

// --- Agent plan & subtask publishers (legacy, kept for subtask workflow) ---

export async function publishSubtaskSpawned(
  channelId: string,
  data: { subtaskId: string; description: string; nodeId: string },
) {
  await redis.publish(channelId, JSON.stringify({ type: "subtask.spawned", ...data }));
}

export async function publishSubtaskComplete(
  channelId: string,
  data: { subtaskId: string; summary: string; status: string },
) {
  await redis.publish(channelId, JSON.stringify({ type: "subtask.complete", ...data }));
}

// --- Retry visibility ---

export async function publishRetry(
  channelId: string,
  data: { attempt: number; maxAttempts: number; error: string },
) {
  await redis.publish(channelId, JSON.stringify({ type: "retry", ...data }));
}
