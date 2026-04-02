/**
 * OpenTelemetry tracing middleware for Hono (Bun-compatible).
 *
 * Bun does not support AsyncLocalStorage, so we cannot rely on
 * OTel's context.with() for context propagation. Instead, we store
 * the span directly on the Hono context object and manually end it.
 *
 * Creates a root span for each HTTP request with standard semantic
 * conventions. Sets the trace ID as the request ID.
 */

import { createMiddleware } from "hono/factory";
import { getTracer, isOtelEnabled, SpanStatusCode, recordSpan, type Span } from "../lib/telemetry";

export const tracing = () =>
  createMiddleware(async (c, next) => {
    if (!isOtelEnabled()) {
      await next();
      return;
    }

    const tracer = getTracer();
    const path = c.req.path;
    const method = c.req.method;

    const startTimeMs = Date.now();
    const span = tracer.startSpan(`${method} ${path}`, {
      attributes: {
        "http.request.method": method,
        "url.path": path,
        "http.route": path,
      },
    });

    // Use trace ID as request ID for unified correlation
    const spanContext = span.spanContext();
    c.set("requestId", spanContext.traceId);
    c.header("X-Request-Id", spanContext.traceId);

    try {
      await next();

      const status = c.res.status;
      span.setAttribute("http.response.status_code", status);

      if (status >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${status}` });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      // Add user/org context if available (set by auth + orgScope middleware)
      const userId = c.get("userId") as string | undefined;
      const orgId = c.get("orgId") as string | undefined;
      if (userId) span.setAttribute("enduser.id", userId);
      if (orgId) span.setAttribute("nova.org_id", orgId);

      span.end();

      // Manual export — Bun's OTel SDK doesn't fire span processor callbacks
      const extraAttrs: Record<string, string | number> = {};
      if (userId) extraAttrs["enduser.id"] = userId;
      if (orgId) extraAttrs["nova.org_id"] = orgId;
      extraAttrs["http.response.status_code"] = c.res.status;
      recordSpan(span, startTimeMs, extraAttrs);
    }
  });
