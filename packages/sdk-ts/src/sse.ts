/**
 * SSE (Server-Sent Events) helpers for building worker /invoke responses.
 * Use these in your HTTP worker to construct the SSE stream.
 */

import type { InvokeResult, ToolCallRecord } from "@nova/protocol";

/** Format an SSE event string. */
export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export class SSEHelper {
  /** Emit a token event. */
  static token(content: string): string {
    return sseEvent("token", { type: "token", content });
  }

  /** Emit a tool_status event. */
  static toolStatus(
    tool: string,
    status: string,
    extra?: { args?: Record<string, unknown>; resultSummary?: string },
  ): string {
    return sseEvent("tool_status", { type: "tool_status", tool, status, ...extra });
  }

  /** Emit a content_clear event. */
  static contentClear(reason?: string): string {
    return sseEvent("content_clear", { type: "content_clear", reason });
  }

  /** Emit a done event. */
  static done(result: {
    content: string;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    messageIds?: string[];
    toolCallRecords?: ToolCallRecord[];
    steps?: number;
  }): string {
    return sseEvent("done", { type: "done", ...result });
  }

  /** Emit an error event. */
  static error(message: string, retryable = false): string {
    return sseEvent("error", { type: "error", message, retryable });
  }

  /** Emit a tier.assessed event. */
  static tierAssessed(tier: string, reasoning: string): string {
    return sseEvent("tier.assessed", { type: "tier.assessed", tier, reasoning });
  }
}
