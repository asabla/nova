import { createMiddleware } from "hono/factory";
import { db } from "../lib/db";
import { userProfiles } from "@nova/shared/schemas";
import { and, eq, isNull } from "drizzle-orm";
import type { Role } from "@nova/shared/constants";

export const roleResolver = () =>
  createMiddleware(async (c, next) => {
    const userId = c.get("userId");
    const orgId = c.get("orgId");

    const [profile] = await db
      .select({ role: userProfiles.role })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.userId, userId),
          eq(userProfiles.orgId, orgId),
          isNull(userProfiles.deletedAt),
        ),
      );

    if (!profile) {
      return c.json({ error: "You are not a member of this organisation" }, 403);
    }

    c.set("userRole", profile.role as Role);
    await next();
  });
