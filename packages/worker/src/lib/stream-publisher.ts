import type { ResearchProgressType, ResearchStatus, ToolCallStatus } from "@nova/shared/constants";
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

// --- Agent plan & subtask publishers ---

export async function publishPlanStep(
  channelId: string,
  data: { step: number; description: string; status: "pending" | "running" | "completed" | "failed" },
) {
  await redis.publish(channelId, JSON.stringify({ type: "plan.step", ...data }));
}

export async function publishPlanGenerated(
  channelId: string,
  data: { steps: { number: number; description: string }[]; reasoning: string },
) {
  await redis.publish(channelId, JSON.stringify({ type: "plan.generated", ...data }));
}

export async function publishSubtaskSpawned(
  channelId: string,
  data: { subtaskId: string; description: string; step: number },
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
