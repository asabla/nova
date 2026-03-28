import { Context } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/common";
import type { AgentWorkflowInput, AgentWorkflowResult, ToolCallRecord } from "@nova/shared/types";
import { publishToken, publishToolStatus, publishContentClear, publishTierAssessed, publishPlanGeneratedV2, publishPlanNodeStatus, publishInteractionRequest, publishResearchStatus, publishResearchSource, publishResearchProgress, publishResearchDone, publishResearchError, publishRetry } from "@nova/worker-shared/stream";
import crypto from "node:crypto";

export interface ProxyWorkerInput {
  workerUrl: string;
  workerAuthSecret: string;
  workflowInput: AgentWorkflowInput;
  streamChannelId: string;
  timeoutMs: number;
  gatewayJwt: string;
}

/**
 * Temporal activity that proxies execution to an external HTTP worker.
 *
 * 1. Signs the request body with HMAC-SHA256
 * 2. POSTs to workerUrl/invoke with the workflow input
 * 3. Reads back an SSE stream
 * 4. For each SSE event, republishes to Redis via stream-publisher
 * 5. Returns AgentWorkflowResult from the "done" event
 */
export async function proxyWorkerActivity(input: ProxyWorkerInput): Promise<AgentWorkflowResult> {
  const body = JSON.stringify(input.workflowInput);

  // HMAC signature for the worker to verify the request is from NOVA
  const signature = crypto
    .createHmac("sha256", input.workerAuthSecret)
    .update(body)
    .digest("hex");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  // Heartbeat interval to keep Temporal activity alive during long streams
  const heartbeatInterval = setInterval(() => {
    Context.current().heartbeat("streaming");
  }, 15_000);

  try {
    const response = await fetch(`${input.workerUrl}/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nova-Signature": `sha256=${signature}`,
        Authorization: `Bearer ${input.gatewayJwt}`,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw ApplicationFailure.nonRetryable(
        `Worker returned ${response.status}: ${errorBody}`,
        "WORKER_HTTP_ERROR",
      );
    }

    if (!response.body) {
      throw ApplicationFailure.nonRetryable("Worker returned no response body", "WORKER_NO_BODY");
    }

    return await consumeSSEStream(response.body, input.streamChannelId);
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeatInterval);
  }
}

/**
 * Reads an SSE stream from a worker and republishes events to Redis.
 * Returns the AgentWorkflowResult extracted from the "done" event.
 */
async function consumeSSEStream(
  body: ReadableStream<Uint8Array>,
  channelId: string,
): Promise<AgentWorkflowResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AgentWorkflowResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "";
      let currentData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6);
        } else if (line === "" && currentEvent && currentData) {
          // End of SSE event
          await handleSSEEvent(channelId, currentEvent, currentData);

          if (currentEvent === "done") {
            const data = JSON.parse(currentData);
            result = buildResult(data);
          } else if (currentEvent === "error") {
            const data = JSON.parse(currentData);
            if (data.retryable) {
              throw ApplicationFailure.retryable(data.message, "WORKER_ERROR");
            }
            throw ApplicationFailure.nonRetryable(data.message, "WORKER_ERROR");
          }

          currentEvent = "";
          currentData = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!result) {
    throw ApplicationFailure.nonRetryable(
      "Worker stream ended without a 'done' event",
      "WORKER_INCOMPLETE",
    );
  }

  return result;
}

/**
 * Republish a single SSE event from the worker to Redis.
 */
async function handleSSEEvent(channelId: string, event: string, rawData: string): Promise<void> {
  const data = JSON.parse(rawData);

  switch (event) {
    case "token":
      await publishToken(channelId, data.content);
      break;
    case "tool_status":
      await publishToolStatus(channelId, data.tool, data.status, {
        args: data.args,
        resultSummary: data.resultSummary,
      });
      break;
    case "content_clear":
      await publishContentClear(channelId, data.reason);
      break;
    case "tier.assessed":
      await publishTierAssessed(channelId, { tier: data.tier, reasoning: data.reasoning });
      break;
    case "plan.generated":
      await publishPlanGeneratedV2(channelId, data.plan);
      break;
    case "plan.node.status":
      await publishPlanNodeStatus(channelId, { nodeId: data.nodeId, status: data.status, detail: data.detail });
      break;
    case "interaction.request":
      await publishInteractionRequest(channelId, data.request);
      break;
    case "research.status":
      await publishResearchStatus(channelId, data.status, data.phase);
      break;
    case "research.source":
      await publishResearchSource(channelId, { title: data.title, url: data.url, relevance: data.relevance });
      break;
    case "research.progress":
      await publishResearchProgress(channelId, data.progressType, data.message, { sourceUrl: data.sourceUrl });
      break;
    case "research.done":
      await publishResearchDone(channelId, { reportId: data.reportId, sourcesCount: data.sourcesCount });
      break;
    case "research.error":
      await publishResearchError(channelId, data.message);
      break;
    case "retry":
      await publishRetry(channelId, { attempt: data.attempt, maxAttempts: data.maxAttempts, error: data.error });
      break;
    // "done" and "error" are handled in the caller
  }
}

function buildResult(data: any): AgentWorkflowResult {
  return {
    conversationId: data.conversationId ?? "",
    content: data.content ?? "",
    messageIds: data.messageIds ?? [],
    totalTokens: data.usage?.totalTokens ?? 0,
    inputTokens: data.usage?.inputTokens ?? 0,
    outputTokens: data.usage?.outputTokens ?? 0,
    steps: data.steps ?? 1,
    status: data.status ?? "completed",
    toolCallRecords: (data.toolCallRecords ?? []) as ToolCallRecord[],
    tier: data.tier ?? "direct",
  };
}
