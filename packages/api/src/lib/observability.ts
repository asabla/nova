import { env } from "./env";
import { logger } from "./logger";

/**
 * LangFuse / Helicone observability integration (Story #160).
 *
 * When LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set, traces are sent
 * to LangFuse via its REST ingestion API. This avoids a heavy SDK dependency
 * and keeps things runtime-agnostic (works on both Bun and Node).
 *
 * The module also supports Helicone via request header injection (proxy mode).
 */

interface TraceEvent {
  traceId: string;
  name: string;
  type: "generation" | "span" | "event";
  startTime: string;
  endTime?: string;
  model?: string;
  input?: unknown;
  output?: unknown;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  metadata?: Record<string, unknown>;
  statusMessage?: string;
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
}

const langfuseEnabled = !!(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
const langfuseHost = env.LANGFUSE_HOST ?? "https://cloud.langfuse.com";

// Batch buffer for non-blocking ingestion
let eventBuffer: TraceEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BUFFER_SIZE = 50;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushEvents().catch((err) => logger.error({ err }, "[observability] flush failed"));
  }, FLUSH_INTERVAL_MS);
}

async function flushEvents() {
  if (eventBuffer.length === 0) return;

  const events = eventBuffer.splice(0, eventBuffer.length);
  const batch = events.map((e) => ({
    id: crypto.randomUUID(),
    type: e.type === "generation" ? "generation-create" : e.type === "span" ? "span-create" : "event-create",
    timestamp: e.startTime,
    body: {
      traceId: e.traceId,
      name: e.name,
      startTime: e.startTime,
      endTime: e.endTime,
      model: e.model,
      input: e.input,
      output: e.output,
      usage: e.usage,
      metadata: e.metadata,
      statusMessage: e.statusMessage,
      level: e.level ?? "DEFAULT",
    },
  }));

  try {
    const auth = Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString("base64");
    await fetch(`${langfuseHost}/api/public/ingestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ batch }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.error({ err }, "[observability] Failed to flush to LangFuse");
    // Re-queue events that failed to send (up to limit)
    if (eventBuffer.length < MAX_BUFFER_SIZE * 2) {
      eventBuffer.unshift(...events);
    }
  }
}

/**
 * Record a trace event. Non-blocking — events are batched and flushed periodically.
 */
export function recordTrace(event: TraceEvent) {
  if (!langfuseEnabled) return;
  eventBuffer.push(event);
  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    flushEvents().catch((err) => logger.error({ err }, "[observability] flush failed"));
  } else {
    scheduleFlush();
  }
}

/**
 * Generate Helicone-compatible headers for LLM proxy calls.
 * These headers are injected when making LiteLLM requests.
 */
export function getHeliconeHeaders(metadata?: {
  userId?: string;
  orgId?: string;
  conversationId?: string;
  agentId?: string;
}): Record<string, string> {
  const heliconeKey = process.env.HELICONE_API_KEY;
  if (!heliconeKey) return {};

  const headers: Record<string, string> = {
    "Helicone-Auth": `Bearer ${heliconeKey}`,
  };
  if (metadata?.userId) headers["Helicone-User-Id"] = metadata.userId;
  if (metadata?.orgId) headers["Helicone-Property-OrgId"] = metadata.orgId;
  if (metadata?.conversationId) headers["Helicone-Property-ConversationId"] = metadata.conversationId;
  if (metadata?.agentId) headers["Helicone-Property-AgentId"] = metadata.agentId;

  return headers;
}

/**
 * Create a generation trace for an LLM call. Call this before and after.
 */
export function traceGeneration(params: {
  traceId: string;
  model: string;
  input: unknown;
  output?: unknown;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  startTime: string;
  endTime?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}) {
  recordTrace({
    traceId: params.traceId,
    name: `llm.${params.model}`,
    type: "generation",
    model: params.model,
    input: params.input,
    output: params.output,
    usage: params.usage,
    startTime: params.startTime,
    endTime: params.endTime,
    metadata: params.metadata,
    statusMessage: params.error,
    level: params.error ? "ERROR" : "DEFAULT",
  });
}

/**
 * Force flush any buffered events (e.g. on shutdown).
 */
export async function flushObservability() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushEvents();
}

export { langfuseEnabled };
