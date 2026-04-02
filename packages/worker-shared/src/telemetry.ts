/**
 * OpenTelemetry initialization for Nova workers (Node.js runtime).
 *
 * Uses the full sdk-node with auto-instrumentations for HTTP and
 * database clients. Traces are exported via OTLP/gRPC to the collector.
 *
 * Import this module at the very top of each worker's index.ts.
 */

import { trace, context, SpanStatusCode, TraceFlags, type Span, type SpanContext } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { BatchSpanProcessor, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

const OTEL_ENABLED = process.env.OTEL_ENABLED === "true";

let sdk: NodeSDK | null = null;

export function initTelemetry(serviceName?: string) {
  if (!OTEL_ENABLED) return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317";
  const name = serviceName ?? process.env.OTEL_SERVICE_NAME ?? "nova-worker";

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: name,
    [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? "0.0.0",
  });

  const exporter = new OTLPTraceExporter({ url: endpoint });

  sdk = new NodeSDK({
    resource,
    spanProcessors: [
      process.env.NODE_ENV === "development"
        ? new SimpleSpanProcessor(exporter)
        : new BatchSpanProcessor(exporter),
    ],
    instrumentations: [
      new HttpInstrumentation(),
    ],
  });

  sdk.start();
}

export async function shutdownTelemetry() {
  if (sdk) {
    await sdk.shutdown();
  }
}

export function getTracer(name = "nova-worker") {
  return trace.getTracer(name);
}

export function isOtelEnabled() {
  return OTEL_ENABLED;
}

/**
 * Wrap a function in an OTel span. Use for instrumenting activities.
 */
export async function traceActivity<T>(name: string, attrs: Record<string, string | number>, fn: () => Promise<T>): Promise<T> {
  if (!OTEL_ENABLED) return fn();
  const tracer = getTracer();
  const span = tracer.startSpan(name, { attributes: attrs }, context.active());
  try {
    const result = await fn();
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
    span.recordException(err as Error);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Parse a traceContext string ("traceId:parentSpanId") and create an
 * OTel parent context from it. Used to link worker spans to the API trace.
 */
function makeParentContext(traceContext: string) {
  const [traceId, parentSpanId] = traceContext.split(":");
  if (!traceId) return null;
  const parentSpanContext: SpanContext = {
    traceId,
    spanId: parentSpanId || "0000000000000000",
    traceFlags: TraceFlags.SAMPLED,
    isRemote: true,
  };
  return trace.setSpanContext(context.active(), parentSpanContext);
}

/**
 * Create a child span linked to a remote parent trace and span ID.
 * traceContext format: "traceId:parentSpanId"
 */
export function startChildSpan(name: string, traceContext: string, attrs?: Record<string, string | number>): Span {
  const tracer = getTracer();
  const parentContext = makeParentContext(traceContext);
  if (!parentContext) return tracer.startSpan(name, { attributes: attrs });
  return tracer.startSpan(name, { attributes: attrs }, parentContext);
}

/**
 * Derive a new traceContext string from a span, preserving the traceId
 * but using this span's spanId as the new parent. Use this to create
 * intermediate hierarchy levels (e.g., agent.run → stream.token).
 */
export function deriveTraceContext(span: Span): string {
  const sc = span.spanContext();
  return `${sc.traceId}:${sc.spanId}`;
}

export { trace, context, SpanStatusCode };
export type { Span };
