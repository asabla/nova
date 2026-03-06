import { createMiddleware } from "hono/factory";
import { auth } from "../lib/auth";
import { AppError } from "@nova/shared/utils";

export const authMiddleware = () =>
  createMiddleware(async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.session || !session?.user) {
      throw AppError.unauthorized();
    }

    c.set("userId", session.user.id);
    await next();
  });
