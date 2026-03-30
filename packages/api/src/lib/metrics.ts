import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();

// Collect Node.js default metrics (CPU, memory, event loop, GC)
collectDefaultMetrics({ register: registry });

// HTTP request metrics
export const httpRequestsTotal = new Counter({
  name: "nova_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: "nova_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

// WebSocket connections
export const wsConnectionsActive = new Gauge({
  name: "nova_ws_connections_active",
  help: "Number of active WebSocket connections",
  registers: [registry],
});

// LLM / streaming metrics
export const streamingRequestsActive = new Gauge({
  name: "nova_streaming_requests_active",
  help: "Number of active SSE streaming requests",
  registers: [registry],
});

export const llmTokensTotal = new Counter({
  name: "nova_llm_tokens_total",
  help: "Total LLM tokens consumed",
  labelNames: ["direction", "model"] as const,
  registers: [registry],
});

// Temporal workflow dispatch
export const workflowsDispatchedTotal = new Counter({
  name: "nova_workflows_dispatched_total",
  help: "Total Temporal workflows dispatched",
  labelNames: ["type", "queue"] as const,
  registers: [registry],
});

// Error counter
export const errorsTotal = new Counter({
  name: "nova_errors_total",
  help: "Total application errors",
  labelNames: ["type"] as const,
  registers: [registry],
});
