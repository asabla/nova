import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { notifications, notificationPreferences } from "@nova/shared/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { parsePagination, buildPaginatedResponse } from "@nova/shared/utils";

const notificationsRouter = new Hono<AppContext>();

notificationsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const page = Number(c.req.query("page") ?? 1);
  const pageSize = Number(c.req.query("pageSize") ?? 20);
  const { offset, limit } = parsePagination({ page, pageSize });

  const where = and(
    eq(notifications.userId, userId),
    eq(notifications.orgId, orgId),
    isNull(notifications.deletedAt),
  );

  const [data, countResult] = await Promise.all([
    db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).offset(offset).limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(where),
  ]);

  return c.json(buildPaginatedResponse(data, countResult[0]?.count ?? 0, { offset, limit, page, pageSize }));
});

notificationsRouter.get("/unread-count", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.orgId, orgId),
      eq(notifications.isRead, false),
      isNull(notifications.deletedAt),
    ));

  return c.json({ count: result[0]?.count ?? 0 });
});

notificationsRouter.post("/:id/read", async (c) => {
  const userId = c.get("userId");
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, c.req.param("id")), eq(notifications.userId, userId)))
    .returning();
  return c.json(result[0] ?? { ok: false });
});

notificationsRouter.post("/read-all", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.orgId, orgId), eq(notifications.isRead, false)));
  return c.json({ ok: true });
});

notificationsRouter.get("/preferences", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.orgId, orgId)));
  return c.json(prefs);
});

const prefSchema = z.object({
  notificationType: z.string(),
  channel: z.enum(["in_app", "email", "webhook", "slack"]),
  isEnabled: z.boolean(),
});

notificationsRouter.put("/preferences", zValidator("json", prefSchema), async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const data = c.req.valid("json");

  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.orgId, orgId),
      eq(notificationPreferences.notificationType, data.notificationType),
      eq(notificationPreferences.channel, data.channel),
    ));

  if (existing.length > 0) {
    const result = await db
      .update(notificationPreferences)
      .set({ isEnabled: data.isEnabled, updatedAt: new Date() })
      .where(eq(notificationPreferences.id, existing[0].id))
      .returning();
    return c.json(result[0]);
  }

  const result = await db.insert(notificationPreferences).values({
    userId,
    orgId,
    ...data,
  }).returning();
  return c.json(result[0], 201);
});

export { notificationsRouter as notificationRoutes };
