/**
 * OpenTelemetry tracing middleware for Hono.
 *
 * Creates a root span for each HTTP request with standard semantic
 * conventions. Propagates W3C traceparent from incoming headers.
 * Sets the trace ID as the request ID for unified correlation.
 */

import { createMiddleware } from "hono/factory";
import { getTracer, isOtelEnabled, context, propagation, SpanStatusCode, trace } from "../lib/telemetry";

export const tracing = () =>
  createMiddleware(async (c, next) => {
    if (!isOtelEnabled()) {
      await next();
      return;
    }

    const tracer = getTracer();

    // Extract incoming trace context (e.g., from frontend or upstream service)
    const incomingContext = propagation.extract(context.active(), c.req.raw.headers, {
      get(carrier, key) {
        return (carrier as Headers).get(key) ?? undefined;
      },
      keys(carrier) {
        return [...(carrier as Headers).keys()];
      },
    });

    const path = c.req.path;
    const method = c.req.method;

    await context.with(incomingContext, async () => {
      const span = tracer.startSpan(`${method} ${path}`, {
        attributes: {
          "http.request.method": method,
          "url.path": path,
          "http.route": path,
        },
      });

      // Make the span's trace ID available as the request ID
      const spanContext = span.spanContext();
      c.set("requestId", spanContext.traceId);
      c.header("X-Request-Id", spanContext.traceId);

      // Store span in Hono context for downstream use
      const otelCtx = trace.setSpan(context.active(), span);

      try {
        await context.with(otelCtx, async () => {
          await next();
        });

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
        // Add user/org context if available
        const userId = c.get("userId") as string | undefined;
        const orgId = c.get("orgId") as string | undefined;
        if (userId) span.setAttribute("enduser.id", userId);
        if (orgId) span.setAttribute("nova.org_id", orgId);

        span.end();
      }
    });
  });
