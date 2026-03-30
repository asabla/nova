import { createMiddleware } from "hono/factory";
import { logger as pinoLogger } from "../lib/logger";

export const logger = () =>
  createMiddleware(async (c, next) => {
    const start = performance.now();
    await next();
    const duration = Math.round(performance.now() - start);
    const status = c.res.status;
    const method = c.req.method;
    const path = c.req.path;
    const requestId = c.get("requestId") ?? "-";

    const logData = { requestId, method, path, status, duration };
    if (status >= 500) {
      pinoLogger.error(logData, "request completed");
    } else if (status >= 400) {
      pinoLogger.warn(logData, "request completed");
    } else {
      pinoLogger.info(logData, "request completed");
    }
  });
