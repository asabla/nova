import type { ExecutionTier, Plan, PlanNodeStatus, UserInteractionRequest } from "@nova/shared/types";
import {
  publishToken,
  publishTierAssessed,
  publishPlanGeneratedV2,
  publishPlanApproved,
  publishPlanNodeStatus,
  publishInteractionRequest,
  publishDone,
} from "../lib/stream-publisher";

export async function publishTierAssessedActivity(
  channelId: string,
  data: { tier: ExecutionTier; reasoning: string },
) {
  await publishTierAssessed(channelId, data);
}

export async function publishPlanGeneratedActivity(
  channelId: string,
  plan: Plan,
) {
  await publishPlanGeneratedV2(channelId, plan);
}

export async function publishPlanApprovedActivity(
  channelId: string,
  planId: string,
) {
  await publishPlanApproved(channelId, planId);
}

export async function publishPlanNodeStatusActivity(
  channelId: string,
  data: { nodeId: string; status: PlanNodeStatus; detail?: string },
) {
  await publishPlanNodeStatus(channelId, data);
}

export async function publishInteractionRequestActivity(
  channelId: string,
  request: UserInteractionRequest,
) {
  await publishInteractionRequest(channelId, request);
}

export async function publishTokenActivity(channelId: string, content: string) {
  await publishToken(channelId, content);
}

export async function publishDoneActivity(
  channelId: string,
  result: { content: string; usage: { prompt_tokens?: number; completion_tokens?: number } },
) {
  await publishDone(channelId, result);
}
