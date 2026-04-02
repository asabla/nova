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
 * Create a child span linked to a remote parent trace ID.
 * This is how worker spans become part of the API request's trace.
 */
export function startChildSpan(name: string, remoteTraceId: string, attrs?: Record<string, string | number>): Span {
  const tracer = getTracer();

  // Construct a remote parent context from the trace ID
  const parentSpanContext: SpanContext = {
    traceId: remoteTraceId,
    spanId: randomSpanId(),
    traceFlags: TraceFlags.SAMPLED,
    isRemote: true,
  };
  const parentContext = trace.setSpanContext(context.active(), parentSpanContext);

  return tracer.startSpan(name, { attributes: attrs }, parentContext);
}

function randomSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export { trace, context, SpanStatusCode };
export type { Span };
