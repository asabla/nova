import { createMiddleware } from "hono/factory";

export const requestId = () =>
  createMiddleware(async (c, next) => {
    const id = c.req.header("x-request-id") ?? crypto.randomUUID();
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
  });
