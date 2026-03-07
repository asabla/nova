import { createMiddleware } from "hono/factory";
import { auth } from "../lib/auth";
import { AppError } from "@nova/shared/utils";
import { db } from "../lib/db";
import { users } from "@nova/shared/schemas";
import { eq } from "drizzle-orm";

export const authMiddleware = () =>
  createMiddleware(async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.session || !session?.user) {
      throw AppError.unauthorized();
    }

    // Resolve Better Auth text ID to NOVA UUID
    const [novaUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.externalId, session.user.id));

    if (novaUser) {
      c.set("userId", novaUser.id);
    } else {
      // Fallback to Better Auth ID if NOVA user doesn't exist yet
      // (init endpoint will create it)
      c.set("userId", session.user.id);
    }

    await next();
  });
