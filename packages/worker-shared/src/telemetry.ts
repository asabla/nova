/**
 * OpenTelemetry initialization for Nova workers (Node.js runtime).
 *
 * Uses the full sdk-node with auto-instrumentations for HTTP and
 * database clients. Traces are exported via OTLP/gRPC to the collector.
 *
 * Import this module at the very top of each worker's index.ts.
 */

import { trace, context, SpanStatusCode, type Span } from "@opentelemetry/api";
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

export { trace, context, SpanStatusCode };
export type { Span };
