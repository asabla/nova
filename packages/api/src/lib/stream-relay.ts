import { redis, redisSub } from "./redis";

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

          case "content_clear":
            // Worker detected tool calls after streaming reasoning text — discard it
            accumulatedContent = "";
            stream.writeSSE({
              event: "content_clear",
              data: JSON.stringify({ reason: data.reason }),
            }).catch(() => {
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

          // --- Agent flow events (tier, plan, interaction) ---
          case "tier.assessed":
          case "plan.generated":
          case "plan.approved":
          case "plan.node.status":
          case "interaction.request":
          case "interaction.response":
          case "subtask.spawned":
          case "subtask.complete": {
            const { type: eventType, ...eventData } = data;
            stream.writeSSE({
              event: eventType,
              data: JSON.stringify(eventData),
            }).catch(() => {
              if (!settled) { settled = true; cleanup(); resolve({ content: accumulatedContent, usage: {} }); }
            });
            break;
          }

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
          // Research-specific events
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

          // Agent-style events (from agentic research workflow)
          case "token":
            safeWrite("token", JSON.stringify({ content: data.content }));
            break;

          case "tool_status":
            safeWrite("tool_status", JSON.stringify({
              tool: data.tool,
              status: data.status,
              ...(data.args ? { args: data.args } : {}),
              ...(data.resultSummary ? { resultSummary: data.resultSummary } : {}),
            }));
            break;

          case "done":
            // Agent "done" event — treat as research.done for the relay
            if (settled) return;
            settled = true;
            cleanup();
            stream.writeSSE({
              event: "research.done",
              data: JSON.stringify({ reportId: channelId.replace("research:", ""), sourcesCount: 0 }),
            }).catch(() => {}).then(() => resolve());
            break;

          case "error":
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

/**
 * Reconnect relay: replays buffered events from a Redis list, then relays live events.
 * Subscribe to pub/sub first, then read the event list to avoid missing anything in between.
 * Events that arrived via pub/sub during the replay are queued and deduplicated.
 */
export async function relayRedisToSSEWithCatchup(
  stream: { writeSSE: (event: { event: string; data: string }) => Promise<void> },
  channelId: string,
  opts: RelayOptions = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const eventsKey = `stream-events:${channelId}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    let replayDone = false;
    let replayedCount = 0;
    const queuedEvents: string[] = [];

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: "Reconnect stream timed out", code: "relay_timeout" }),
      }).then(() => resolve());
    }, timeoutMs);

    /** Forward a raw JSON event string as an SSE event to the client. */
    const forwardEvent = (raw: string) => {
      if (settled) return;
      try {
        const data = JSON.parse(raw);
        const { type: eventType, ...eventData } = data;
        stream.writeSSE({ event: eventType, data: JSON.stringify(eventData) }).catch(() => {
          if (!settled) { settled = true; cleanup(); resolve(); }
        });
      } catch {
        // Skip malformed
      }
    };

    const handler = (channel: string, message: string) => {
      if (channel !== channelId || settled) return;

      // Queue events until replay is done to avoid out-of-order delivery
      if (!replayDone) {
        queuedEvents.push(message);
        return;
      }

      try {
        const data = JSON.parse(message);
        if (data.type === "done") {
          if (settled) return;
          settled = true;
          cleanup();
          stream.writeSSE({
            event: "done",
            data: JSON.stringify({ content: data.content, usage: data.usage }),
          }).catch(() => {}).then(() => resolve());
          return;
        }
        if (data.type === "error") {
          if (settled) return;
          settled = true;
          cleanup();
          stream.writeSSE({
            event: "error",
            data: JSON.stringify({ message: data.message, code: "tool_error" }),
          }).catch(() => {}).then(() => resolve());
          return;
        }
        forwardEvent(message);
      } catch {
        // Skip malformed
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      redisSub.off("message", handler);
      redisSub.unsubscribe(channelId).catch(() => {});
    };

    // 1. Subscribe to pub/sub first (events queued until replay is done)
    redisSub.on("message", handler);
    redisSub.subscribe(channelId).then(async () => {
      console.log(`[relay-reconnect] subscribed to ${channelId.slice(-12)}, timeout=${timeoutMs}ms`);

      // 2. Read all buffered events from the Redis list
      const events = await redis.lrange(eventsKey, 0, -1);
      replayedCount = events.length;

      // 3. Replay each event as SSE to catch the client up
      for (const raw of events) {
        if (settled) break;
        forwardEvent(raw);
      }

      // 4. Read any events added to the list during replay (between lrange and now)
      if (!settled) {
        const newEvents = await redis.lrange(eventsKey, replayedCount, -1);
        for (const raw of newEvents) {
          if (settled) break;
          forwardEvent(raw);
        }
        replayedCount += newEvents.length;
      }

      // 5. Go live — process queued pub/sub events and switch to real-time
      replayDone = true;
      // Drain the queue. Events here may overlap with step 4, but since
      // publishAndBuffer does rpush+publish atomically, events in the queue
      // that have index <= replayedCount are duplicates. We skip them by
      // checking done/error only and letting the handler take over for new events.
      const queued = queuedEvents.splice(0);
      for (const msg of queued) {
        if (settled) break;
        try {
          const data = JSON.parse(msg);
          if (data.type === "done") {
            settled = true;
            cleanup();
            stream.writeSSE({
              event: "done",
              data: JSON.stringify({ content: data.content, usage: data.usage }),
            }).catch(() => {}).then(() => resolve());
            return;
          }
          if (data.type === "error") {
            settled = true;
            cleanup();
            stream.writeSSE({
              event: "error",
              data: JSON.stringify({ message: data.message, code: "tool_error" }),
            }).catch(() => {}).then(() => resolve());
            return;
          }
          // Other events: these were published between lrange and now.
          // They're already replayed from step 4, so skip to avoid duplicates.
        } catch {
          // Skip malformed
        }
      }

      // 6. Check if stream already completed (events key cleaned up = stream ended)
      const stillActive = await redis.exists(eventsKey);
      if (!stillActive && !settled) {
        settled = true;
        cleanup();
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ content: "", usage: {} }),
        }).catch(() => {});
        resolve();
      }
    }).catch((err) => {
      settled = true;
      clearTimeout(timeout);
      redisSub.off("message", handler);
      reject(err);
    });
  });
}
