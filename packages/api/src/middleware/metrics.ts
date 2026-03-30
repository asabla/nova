import { createMiddleware } from "hono/factory";
import { httpRequestsTotal, httpRequestDuration } from "../lib/metrics";

/** Normalize path to avoid high-cardinality labels (strip UUIDs and IDs) */
function normalizePath(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:num");
}

export const metricsMiddleware = () =>
  createMiddleware(async (c, next) => {
    const start = performance.now();
    await next();
    const duration = (performance.now() - start) / 1000;
    const method = c.req.method;
    const path = normalizePath(c.req.path);
    const status = String(c.res.status);

    httpRequestsTotal.inc({ method, path, status });
    httpRequestDuration.observe({ method, path, status }, duration);
  });
