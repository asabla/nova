import { createMiddleware } from "hono/factory";
import { logger as pinoLogger } from "../lib/logger";
import { trace, context } from "@opentelemetry/api";

export const logger = () =>
  createMiddleware(async (c, next) => {
    const start = performance.now();
    await next();
    const duration = Math.round(performance.now() - start);
    const status = c.res.status;
    const method = c.req.method;
    const path = c.req.path;
    const requestId = c.get("requestId") ?? "-";

    // Add OTel trace/span IDs for log-to-trace correlation
    const span = trace.getSpan(context.active());
    const spanCtx = span?.spanContext();
    const userId = c.get("userId") as string | undefined;
    const orgId = c.get("orgId") as string | undefined;
    const logData = {
      requestId,
      method,
      path,
      status,
      duration,
      ...(userId ? { userId } : {}),
      ...(orgId ? { orgId } : {}),
      ...(spanCtx?.traceId ? { traceId: spanCtx.traceId, spanId: spanCtx.spanId } : {}),
    };

    if (status >= 500) {
      pinoLogger.error(logData, "request completed");
    } else if (status >= 400) {
      pinoLogger.warn(logData, "request completed");
    } else {
      pinoLogger.info(logData, "request completed");
    }
  });
