/**
 * OpenTelemetry initialization for the Nova API (Bun runtime).
 *
 * Uses the base SDK (not sdk-node) since Bun doesn't support all Node.js
 * auto-instrumentations. Traces are exported via OTLP/gRPC to the collector.
 *
 * Import this module at the very top of index.ts — before any other imports.
 */

import { trace, context, propagation, SpanStatusCode, type Span, type Context } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { BasicTracerProvider, BatchSpanProcessor, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";

const OTEL_ENABLED = process.env.OTEL_ENABLED === "true";

let provider: BasicTracerProvider | null = null;

export function initTelemetry() {
  if (!OTEL_ENABLED) return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317";
  const serviceName = process.env.OTEL_SERVICE_NAME ?? "nova-api";

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? "0.0.0",
  });

  const exporter = new OTLPTraceExporter({ url: endpoint });

  provider = new BasicTracerProvider({
    resource,
    spanProcessors: [
      process.env.NODE_ENV === "development"
        ? new SimpleSpanProcessor(exporter)
        : new BatchSpanProcessor(exporter),
    ],
  });

  trace.setGlobalTracerProvider(provider);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
}

export async function shutdownTelemetry() {
  if (provider) {
    await provider.shutdown();
  }
}

export function getTracer(name = "nova-api") {
  return trace.getTracer(name);
}

export function isOtelEnabled() {
  return OTEL_ENABLED;
}

export { trace, context, propagation, SpanStatusCode };
export type { Span, Context };
