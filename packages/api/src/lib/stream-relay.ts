import { redisSub } from "./redis";

interface RelayOptions {
  timeoutMs?: number;
}

/**
 * Subscribe to a Redis channel and relay messages as SSE events.
 * Resolves when a "done" or "error" message is received, or on timeout.
 * Returns the final accumulated content from the worker.
 */
export async function relayRedisToSSE(
  stream: { writeSSE: (event: { event: string; data: string }) => Promise<void> },
  channelId: string,
  opts: RelayOptions = {},
): Promise<{ content: string; usage: { prompt_tokens?: number; completion_tokens?: number } } | null> {
  const timeoutMs = opts.timeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    let settled = false;
    let accumulatedContent = "";

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      console.log(`[relay] TIMEOUT after ${timeoutMs}ms, ${messageCount} messages received, ${accumulatedContent.length} chars`);
      stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: "Tool execution timed out", code: "relay_timeout" }),
      }).then(() => resolve({
        content: accumulatedContent,
        usage: {},
      }));
    }, timeoutMs);

    let messageCount = 0;
    const handler = (channel: string, message: string) => {
      if (channel !== channelId || settled) return;
      messageCount++;

      try {
        const data = JSON.parse(message);
        console.log(`[relay] msg #${messageCount} type=${data.type} channel=${channel.slice(-12)} accLen=${accumulatedContent.length}`);

        switch (data.type) {
          case "token":
            accumulatedContent += data.content;
            stream.writeSSE({ event: "token", data: JSON.stringify({ content: data.content }) });
            break;

          case "tool_status":
            stream.writeSSE({
              event: "tool_status",
              data: JSON.stringify({
                tool: data.tool,
                status: data.status,
                ...(data.args ? { args: data.args } : {}),
                ...(data.resultSummary ? { resultSummary: data.resultSummary } : {}),
              }),
            });
            break;

          case "done":
            settled = true;
            cleanup();
            resolve({
              content: data.content ?? accumulatedContent,
              usage: data.usage ?? {},
            });
            break;

          case "error":
            console.log(`[relay] ERROR received: ${data.message}, accumulated ${accumulatedContent.length} chars`);
            settled = true;
            cleanup();
            stream.writeSSE({
              event: "error",
              data: JSON.stringify({ message: data.message, code: "tool_error" }),
            }).then(() => resolve({
              content: accumulatedContent,
              usage: {},
            }));
            break;
        }
      } catch {
        // Skip malformed messages
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      redisSub.off("message", handler);
      redisSub.unsubscribe(channelId).catch(() => {});
    };

    redisSub.subscribe(channelId).then(() => {
      console.log(`[relay] subscribed to ${channelId.slice(-12)}, timeout=${timeoutMs}ms`);
      redisSub.on("message", handler);
    }).catch((err) => {
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });
  });
}
