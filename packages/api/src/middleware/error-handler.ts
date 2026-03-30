import type { ErrorHandler } from "hono";
import { AppError } from "@nova/shared/utils";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  logger.error({ err, requestId }, err.message);

  if (err instanceof AppError) {
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
