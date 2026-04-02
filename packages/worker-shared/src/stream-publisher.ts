import type { ResearchProgressType, ResearchStatus, ToolCallStatus } from "@nova/shared/constants";
import type {
  ExecutionTier,
  Plan,
  PlanNodeStatus,
  UserInteractionRequest,
  UserInteractionResponse,
} from "@nova/shared/types";
import { redis } from "./redis";
import { startChildSpan, isOtelEnabled } from "./telemetry";

const STREAM_BUFFER_TTL = 1800; // 30 minutes

/** Extract conversationId from channelId format: stream:{conversationId}:{uuid} */
function conversationIdFromChannel(channelId: string): string | null {
  const parts = channelId.split(":");
  return parts.length >= 3 ? parts[1] : null;
}

/** Initialize Redis buffer keys for a new stream. Call before starting the workflow. */
export async function initStreamBuffer(channelId: string, conversationId: string) {
  await Promise.all([
    redis.set(`active-stream:${conversationId}`, channelId, "EX", STREAM_BUFFER_TTL),
    // Use a list to buffer the full event stream for replay
    redis.del(`stream-events:${channelId}`),
  ]);
  await redis.expire(`stream-events:${channelId}`, STREAM_BUFFER_TTL);
}

/** Clean up Redis buffer keys after stream completes or errors. */
export async function cleanupStreamBuffer(channelId: string) {
  const conversationId = conversationIdFromChannel(channelId);
  const keys = [`stream-events:${channelId}`];
  if (conversationId) keys.push(`active-stream:${conversationId}`);
  await redis.del(...keys);
}

/**
 * Publish an event to both pub/sub and the replay buffer.
 * No per-event span — token events are too numerous for individual spans.
 */
async function publishAndBuffer(channelId: string, event: Record<string, unknown>, traceId?: string) {
  const payload = traceId ? { ...event, traceId } : event;
  const json = JSON.stringify(payload);
  await Promise.all([
    redis.publish(channelId, json),
    redis.rpush(`stream-events:${channelId}`, json),
  ]);
}

export async function publishToken(channelId: string, token: string, traceId?: string) {
  await publishAndBuffer(channelId, { type: "token", content: token }, traceId);
}

export async function publishToolStatus(
  channelId: string,
  tool: string,
  status: ToolCallStatus,
  extra?: { args?: Record<string, unknown>; resultSummary?: string },
  traceId?: string,
) {
  // Create a span only for tool invocations (running), not completions
  const span = (traceId && isOtelEnabled() && status === "running")
    ? startChildSpan(`tool: ${tool}`, traceId, { "tool.name": tool })
    : null;
  await publishAndBuffer(channelId, { type: "tool_status", tool, status, ...extra }, traceId);
  span?.end();
}

export async function publishContentClear(channelId: string, reason?: string, traceId?: string) {
  await publishAndBuffer(channelId, { type: "content_clear", reason }, traceId);
}

export async function publishDone(
  channelId: string,
  result: { content: string; usage: { prompt_tokens?: number; completion_tokens?: number } },
  traceId?: string,
) {
  const span = (traceId && isOtelEnabled())
    ? startChildSpan("stream.done", traceId, {
        "stream.channel_id": channelId,
        "stream.prompt_tokens": result.usage.prompt_tokens ?? 0,
        "stream.completion_tokens": result.usage.completion_tokens ?? 0,
      })
    : null;
  const payload = traceId ? { type: "done", ...result, traceId } : { type: "done", ...result };
  await redis.publish(channelId, JSON.stringify(payload));
  await cleanupStreamBuffer(channelId);
  span?.end();
}

export async function publishError(channelId: string, message: string, traceId?: string) {
  const span = (traceId && isOtelEnabled())
    ? startChildSpan("stream.error", traceId, { "stream.channel_id": channelId, "error.message": message })
    : null;
  const payload = traceId ? { type: "error", message, traceId } : { type: "error", message };
  await redis.publish(channelId, JSON.stringify(payload));
  await cleanupStreamBuffer(channelId);
  span?.end();
}

// --- Research event publishers ---

export async function publishResearchStatus(
  channelId: string,
  status: ResearchStatus,
  phase?: string,
) {
  await redis.publish(channelId, JSON.stringify({ type: "research.status", status, phase }));
}

export async function publishResearchSource(
  channelId: string,
  source: { title: string; url: string; relevance?: number },
) {
  await redis.publish(channelId, JSON.stringify({ type: "research.source", ...source }));
}

export async function publishResearchProgress(
  channelId: string,
  progressType: ResearchProgressType,
  message: string,
  extra?: { sourceUrl?: string },
) {
  await redis.publish(channelId, JSON.stringify({ type: "research.progress", progressType, message, ...extra }));
}

export async function publishResearchDone(
  channelId: string,
  data: { reportId: string; sourcesCount: number },
) {
  await redis.publish(channelId, JSON.stringify({ type: "research.done", ...data }));
}

export async function publishResearchError(channelId: string, message: string) {
  await redis.publish(channelId, JSON.stringify({ type: "research.error", message }));
}

// --- Agent flow: tier & plan publishers ---

export async function publishTierAssessed(
  channelId: string,
  data: { tier: ExecutionTier; reasoning: string },
  traceId?: string,
) {
  await redis.publish(channelId, JSON.stringify({ type: "tier.assessed", ...data, ...(traceId ? { traceId } : {}) }));
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

// --- Agent plan & subtask publishers ---

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
