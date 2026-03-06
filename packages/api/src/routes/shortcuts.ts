import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { userKeyboardShortcuts } from "@nova/shared/schemas";
import { eq, and, isNull } from "drizzle-orm";

const shortcutRoutes = new Hono<AppContext>();

shortcutRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const result = await db.select().from(userKeyboardShortcuts)
    .where(and(eq(userKeyboardShortcuts.userId, userId), eq(userKeyboardShortcuts.orgId, orgId), isNull(userKeyboardShortcuts.deletedAt)));
  return c.json(result);
});

const upsertSchema = z.object({
  action: z.string().min(1).max(100),
  keybinding: z.string().min(1).max(100),
});

shortcutRoutes.put("/", zValidator("json", upsertSchema), async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const { action, keybinding } = c.req.valid("json");

  const existing = await db.select().from(userKeyboardShortcuts)
    .where(and(
      eq(userKeyboardShortcuts.userId, userId),
      eq(userKeyboardShortcuts.orgId, orgId),
      eq(userKeyboardShortcuts.action, action),
      isNull(userKeyboardShortcuts.deletedAt),
    ));

  if (existing.length > 0) {
    const [updated] = await db.update(userKeyboardShortcuts)
      .set({ keybinding, updatedAt: new Date() })
      .where(eq(userKeyboardShortcuts.id, existing[0].id))
      .returning();
    return c.json(updated);
  }

  const [created] = await db.insert(userKeyboardShortcuts).values({
    userId,
    orgId,
    action,
    keybinding,
  }).returning();
  return c.json(created, 201);
});

const bulkSchema = z.object({
  shortcuts: z.array(upsertSchema),
});

shortcutRoutes.put("/bulk", zValidator("json", bulkSchema), async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const { shortcuts } = c.req.valid("json");

  const results = [];
  for (const s of shortcuts) {
    const existing = await db.select().from(userKeyboardShortcuts)
      .where(and(
        eq(userKeyboardShortcuts.userId, userId),
        eq(userKeyboardShortcuts.orgId, orgId),
        eq(userKeyboardShortcuts.action, s.action),
        isNull(userKeyboardShortcuts.deletedAt),
      ));

    if (existing.length > 0) {
      const [updated] = await db.update(userKeyboardShortcuts)
        .set({ keybinding: s.keybinding, updatedAt: new Date() })
        .where(eq(userKeyboardShortcuts.id, existing[0].id))
        .returning();
      results.push(updated);
    } else {
      const [created] = await db.insert(userKeyboardShortcuts).values({
        userId, orgId, action: s.action, keybinding: s.keybinding,
      }).returning();
      results.push(created);
    }
  }

  return c.json(results);
});

shortcutRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const [deleted] = await db.update(userKeyboardShortcuts)
    .set({ deletedAt: new Date() })
    .where(and(eq(userKeyboardShortcuts.id, c.req.param("id")), eq(userKeyboardShortcuts.userId, userId)))
    .returning();
  return c.json({ ok: !!deleted });
});

export { shortcutRoutes };
