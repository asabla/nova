import { createMiddleware } from "hono/factory";

export const orgScope = () =>
  createMiddleware(async (c, next) => {
    const orgId = c.req.header("x-org-id");
    if (!orgId) {
      return c.json(
        {
          type: "https://nova.dev/errors/no-org",
          title: "No active organization",
          status: 403,
          detail: "Set the X-Org-Id header to an active organization",
        },
        403,
      );
    }
    c.set("orgId", orgId);
    await next();
  });
