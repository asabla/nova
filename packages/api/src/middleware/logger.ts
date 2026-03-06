import { createMiddleware } from "hono/factory";

export const logger = () =>
  createMiddleware(async (c, next) => {
    const start = performance.now();
    await next();
    const duration = Math.round(performance.now() - start);
    const status = c.res.status;
    const method = c.req.method;
    const path = c.req.path;
    const requestId = c.get("requestId") ?? "-";

    console.log(
      JSON.stringify({
        level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        requestId,
        method,
        path,
        status,
        duration,
        ts: new Date().toISOString(),
      }),
    );
  });
