/**
 * OpenTelemetry tracing middleware for Hono (Bun-compatible).
 *
 * Creates a root span for each HTTP request. For normal requests,
 * the span is recorded when the middleware completes. For streaming
 * endpoints (SSE), the route handler calls finalizeTrace() after
 * the stream completes so the span covers the full duration.
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

    const spanContext = span.spanContext();
    c.set("requestId", spanContext.traceId);
    c.set("spanId", spanContext.spanId);
    c.header("X-Request-Id", spanContext.traceId);

    // Store span on context so route handlers can finalize it for streaming
    (c as any).__otelSpan = span;
    (c as any).__otelStartMs = startTimeMs;

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
      const userId = c.get("userId") as string | undefined;
      const orgId = c.get("orgId") as string | undefined;
      if (userId) span.setAttribute("enduser.id", userId);
      if (orgId) span.setAttribute("nova.org_id", orgId);

      // Only record span if the route hasn't marked it as deferred (streaming)
      if (!(c as any).__otelDeferred) {
        span.end();
        const extraAttrs: Record<string, string | number> = {};
        if (userId) extraAttrs["enduser.id"] = userId;
        if (orgId) extraAttrs["nova.org_id"] = orgId;
        extraAttrs["http.response.status_code"] = c.res.status;
        recordSpan(span, startTimeMs, extraAttrs);
      }
    }
  });

/**
 * Call from streaming route handlers AFTER the stream completes.
 * This records the span with the correct end time covering the full
 * request duration (not just the middleware's 26ms).
 */
export function finalizeTrace(c: any) {
  const span = c.__otelSpan as Span | undefined;
  const startMs = c.__otelStartMs as number | undefined;
  if (!span || !startMs) return;

  const userId = c.get?.("userId") as string | undefined;
  const orgId = c.get?.("orgId") as string | undefined;

  span.end();
  const extraAttrs: Record<string, string | number> = {};
  if (userId) extraAttrs["enduser.id"] = userId;
  if (orgId) extraAttrs["nova.org_id"] = orgId;
  extraAttrs["http.response.status_code"] = c.res?.status ?? 200;
  recordSpan(span, startMs, extraAttrs);
}
