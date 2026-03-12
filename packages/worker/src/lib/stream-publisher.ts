import { redis } from "./redis";

export async function publishToken(channelId: string, token: string) {
  await redis.publish(channelId, JSON.stringify({ type: "token", content: token }));
}

export async function publishToolStatus(
  channelId: string,
  tool: string,
  status: "running" | "completed" | "error",
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
