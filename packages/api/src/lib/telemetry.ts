/**
 * OpenTelemetry-compatible tracing for the Nova API (Bun runtime).
 *
 * The standard OTel SDK's SimpleSpanProcessor does not fire span.onEnd()
 * callbacks in Bun. This module implements a manual span collection and
 * export approach that works around Bun's runtime limitations.
 *
 * Spans are created using the OTel API (for traceId generation and
 * semantic conventions) but exported manually via a Bun-native fetch
 * POST to the OTLP/HTTP JSON endpoint.
 */

import { trace, context, propagation, SpanStatusCode, type Span, type Context } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";

const OTEL_ENABLED = process.env.OTEL_ENABLED === "true";
let provider: BasicTracerProvider | null = null;
let otlpEndpoint = "";
let serviceName = "";
let serviceVersion = "";

// Buffer for manual export
const spanBuffer: Array<{
  traceId: string;
  spanId: string;
  name: string;
  kind: number;
  startTimeMs: number;
  endTimeMs: number;
  attributes: Record<string, string | number | boolean>;
  status: { code: number; message?: string };
  events: Array<{ name: string; timeMs: number; attributes: Record<string, string | number | boolean> }>;
}> = [];

const FLUSH_INTERVAL = 5_000;
const MAX_BUFFER = 100;
let flushTimer: ReturnType<typeof setInterval> | null = null;

async function flush() {
  if (spanBuffer.length === 0) return;
  const spans = spanBuffer.splice(0, MAX_BUFFER);

  const payload = {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: serviceName } },
          { key: "service.version", value: { stringValue: serviceVersion } },
        ],
      },
      scopeSpans: [{
        scope: { name: "nova-api" },
        spans: spans.map((s) => ({
          traceId: s.traceId,
          spanId: s.spanId,
          name: s.name,
          kind: s.kind || 1,
          startTimeUnixNano: String(Math.round(s.startTimeMs * 1_000_000)),
          endTimeUnixNano: String(Math.round(s.endTimeMs * 1_000_000)),
          attributes: Object.entries(s.attributes).map(([key, value]) => ({
            key,
            value: typeof value === "number"
              ? (Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value })
              : typeof value === "boolean"
                ? { boolValue: value }
                : { stringValue: String(value) },
          })),
          status: { code: s.status.code, message: s.status.message },
          events: s.events.map((e) => ({
            name: e.name,
            timeUnixNano: String(Math.round(e.timeMs * 1_000_000)),
            attributes: Object.entries(e.attributes).map(([k, v]) => ({
              key: k,
              value: { stringValue: String(v) },
            })),
          })),
        })),
      }],
    }],
  };

  try {
    const res = await fetch(otlpEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error(`[telemetry] OTLP export failed: ${res.status}`);
  } catch (err) {
    console.error(`[telemetry] OTLP export error: ${(err as Error).message}`);
  }
}

/**
 * Manually record a completed span for export.
 * Call this after span.end() since Bun's OTel SDK doesn't fire onEnd.
 */
export function recordSpan(span: Span, startTimeMs: number, extraAttrs?: Record<string, string | number | boolean>) {
  if (!OTEL_ENABLED) return;
  const sc = span.spanContext();
  const s = span as any;
  const attrs = { ...(s.attributes ?? {}), ...(extraAttrs ?? {}) };
  const status = s.status ?? { code: 0 };
  const events = (s.events ?? []).map((e: any) => ({
    name: e.name,
    timeMs: e.time ? e.time[0] * 1000 + e.time[1] / 1_000_000 : Date.now(),
    attributes: e.attributes ?? {},
  }));

  spanBuffer.push({
    traceId: sc.traceId,
    spanId: sc.spanId,
    name: s.name ?? "unknown",
    kind: s.kind ?? 0,
    startTimeMs,
    endTimeMs: Date.now(),
    attributes: attrs,
    status,
    events,
  });

  if (spanBuffer.length >= MAX_BUFFER) flush();
}

export function initTelemetry() {
  if (!OTEL_ENABLED) return;

  const baseEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
  otlpEndpoint = baseEndpoint.replace(":4317", ":4318") + "/v1/traces";
  serviceName = process.env.OTEL_SERVICE_NAME ?? "nova-api";
  serviceVersion = process.env.APP_VERSION ?? "0.0.0";

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  });

  // Provider for traceId generation only — export is handled manually
  provider = new BasicTracerProvider({ resource });
  trace.setGlobalTracerProvider(provider);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  flushTimer = setInterval(() => {
    if (spanBuffer.length > 0) flush();
  }, FLUSH_INTERVAL);
  console.log(`[telemetry] OTel initialized: service=${serviceName} endpoint=${otlpEndpoint}`);
}

export async function shutdownTelemetry() {
  if (flushTimer) clearInterval(flushTimer);
  await flush();
  if (provider) await provider.shutdown();
}

export function getTracer(name = "nova-api") {
  return trace.getTracer(name);
}

export function isOtelEnabled() {
  return OTEL_ENABLED;
}

export { trace, context, propagation, SpanStatusCode };
export type { Span, Context };
