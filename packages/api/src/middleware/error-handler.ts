import type { ErrorHandler } from "hono";
import { AppError } from "@nova/shared/utils";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { trace, context, SpanStatusCode } from "@opentelemetry/api";
import { errorsTotal } from "../lib/metrics";

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  logger.error({ err, requestId }, err.message);

  // Record exception on the active OTel span
  const span = trace.getSpan(context.active());
  if (span) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  }

  if (err instanceof AppError) {
    errorsTotal.inc({ type: err.status >= 500 ? "server_error" : "client_error" });
    return c.json(
      {
        type: err.type,
        title: err.title,
        status: err.status,
        detail: err.detail,
        instance: c.req.url,
      },
      err.status as any,
    );
  }

  if (err.name === "ZodError") {
    errorsTotal.inc({ type: "validation" });
    return c.json(
      {
        type: "https://nova.dev/errors/validation",
        title: "Validation Error",
        status: 400,
        errors: (err as any).issues,
      },
      400,
    );
  }

  errorsTotal.inc({ type: "server_error" });
  return c.json(
    {
      type: "https://nova.dev/errors/internal",
      title: "Internal Server Error",
      status: 500,
      detail: env.NODE_ENV === "development" ? err.message : "An unexpected error occurred",
    },
    500,
  );
};
