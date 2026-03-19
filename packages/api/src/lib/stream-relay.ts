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
            stream.writeSSE({ event: "token", data: JSON.stringify({ content: data.content }) }).catch(() => {
              // Client disconnected
              if (!settled) { settled = true; cleanup(); resolve({ content: accumulatedContent, usage: {} }); }
            });
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
            }).catch(() => {
              if (!settled) { settled = true; cleanup(); resolve({ content: accumulatedContent, usage: {} }); }
            });
            break;

          case "retry":
            stream.writeSSE({
              event: "retry",
              data: JSON.stringify({
                attempt: data.attempt,
                maxAttempts: data.maxAttempts,
                error: data.error,
              }),
            }).catch(() => {
              if (!settled) { settled = true; cleanup(); resolve({ content: accumulatedContent, usage: {} }); }
            });
            break;

          case "plan.generated":
            stream.writeSSE({
              event: "plan.generated",
              data: JSON.stringify({ steps: data.steps, reasoning: data.reasoning }),
            }).catch(() => {
              if (!settled) { settled = true; cleanup(); resolve({ content: accumulatedContent, usage: {} }); }
            });
            break;

          case "plan.step":
            stream.writeSSE({
              event: "plan.step",
              data: JSON.stringify({ step: data.step, description: data.description, status: data.status }),
            }).catch(() => {
              if (!settled) { settled = true; cleanup(); resolve({ content: accumulatedContent, usage: {} }); }
            });
            break;

          case "subtask.spawned":
            stream.writeSSE({
              event: "subtask.spawned",
              data: JSON.stringify({ subtaskId: data.subtaskId, description: data.description, step: data.step }),
            }).catch(() => {
              if (!settled) { settled = true; cleanup(); resolve({ content: accumulatedContent, usage: {} }); }
            });
            break;

          case "subtask.complete":
            stream.writeSSE({
              event: "subtask.complete",
              data: JSON.stringify({ subtaskId: data.subtaskId, summary: data.summary, status: data.status }),
            }).catch(() => {
              if (!settled) { settled = true; cleanup(); resolve({ content: accumulatedContent, usage: {} }); }
            });
            break;

          case "done":
            if (settled) return;
            settled = true;
            cleanup();
            resolve({
              content: data.content ?? accumulatedContent,
              usage: data.usage ?? {},
            });
            break;

          case "error":
            console.log(`[relay] ERROR received: ${data.message}, accumulated ${accumulatedContent.length} chars`);
            if (settled) return;
            settled = true;
            cleanup();
            stream.writeSSE({
              event: "error",
              data: JSON.stringify({ message: data.message, code: "tool_error" }),
            }).catch(() => {}).then(() => resolve({
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

    // Attach handler before subscribing to avoid missing messages
    redisSub.on("message", handler);
    redisSub.subscribe(channelId).then(() => {
      console.log(`[relay] subscribed to ${channelId.slice(-12)}, timeout=${timeoutMs}ms`);
    }).catch((err) => {
      settled = true;
      clearTimeout(timeout);
      redisSub.off("message", handler);
      reject(err);
    });
  });
}

/**
 * Subscribe to a Redis channel and relay research progress events as SSE.
 * Resolves when a "research.done" or "research.error" message is received.
 */
export async function relayResearchToSSE(
  stream: { writeSSE: (event: { event: string; data: string }) => Promise<void> },
  channelId: string,
  opts: RelayOptions = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 600_000; // 10 min default for research

  return new Promise((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      stream.writeSSE({
        event: "research.error",
        data: JSON.stringify({ message: "Research stream timed out" }),
      }).then(() => resolve());
    }, timeoutMs);

    const safeWrite = (event: string, data: string) => {
      stream.writeSSE({ event, data }).catch(() => {
        if (!settled) { settled = true; cleanup(); resolve(); }
      });
    };

    const handler = (channel: string, message: string) => {
      if (channel !== channelId || settled) return;

      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case "research.status":
            safeWrite("research.status", JSON.stringify({ status: data.status, phase: data.phase }));
            break;

          case "research.source":
            safeWrite("research.source", JSON.stringify({ title: data.title, url: data.url, relevance: data.relevance }));
            break;

          case "research.progress":
            safeWrite("research.progress", JSON.stringify({ type: data.progressType, message: data.message, sourceUrl: data.sourceUrl }));
            break;

          case "research.done":
            if (settled) return;
            settled = true;
            cleanup();
            stream.writeSSE({
              event: "research.done",
              data: JSON.stringify({ reportId: data.reportId, sourcesCount: data.sourcesCount }),
            }).catch(() => {}).then(() => resolve());
            break;

          case "research.error":
            if (settled) return;
            settled = true;
            cleanup();
            stream.writeSSE({
              event: "research.error",
              data: JSON.stringify({ message: data.message }),
            }).catch(() => {}).then(() => resolve());
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

    // Attach handler before subscribing to avoid missing messages
    redisSub.on("message", handler);
    redisSub.subscribe(channelId).then(() => {
      console.log(`[relay-research] subscribed to ${channelId.slice(-12)}, timeout=${timeoutMs}ms`);
    }).catch((err) => {
      settled = true;
      clearTimeout(timeout);
      redisSub.off("message", handler);
      reject(err);
    });
  });
}
