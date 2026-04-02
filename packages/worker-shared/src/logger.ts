import pino from "pino";
import { trace, context } from "@opentelemetry/api";

const env = process.env.NODE_ENV ?? "development";

export const logger = pino({
  level: env === "production" ? "info" : "debug",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin() {
    // Inject OTel traceId/spanId into every log line for correlation
    const span = trace.getSpan(context.active());
    if (span) {
      const ctx = span.spanContext();
      return { traceId: ctx.traceId, spanId: ctx.spanId };
    }
    return {};
  },
});
