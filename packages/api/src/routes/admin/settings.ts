import { Hono } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { orgSettings, organisations } from "@nova/shared/schemas";

const adminSettingsRoutes = new Hono<AppContext>();

// Get platform-wide settings (stored under the system org)
adminSettingsRoutes.get("/", async (c) => {
  // Find the system org
  const [systemOrg] = await db.select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isSystemOrg, true));

  if (!systemOrg) return c.json({ data: [] });

  const settings = await db.select()
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, systemOrg.id), isNull(orgSettings.deletedAt)));

  return c.json({ data: settings, systemOrgId: systemOrg.id });
});

// Set a platform setting
adminSettingsRoutes.put("/:key", async (c) => {
  const key = c.req.param("key");
  const { value } = await c.req.json();

  const [systemOrg] = await db.select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isSystemOrg, true));

  if (!systemOrg) return c.json({ error: "System org not found" }, 404);

  // Upsert
  const [existing] = await db.select()
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, systemOrg.id), eq(orgSettings.key, key)));

  if (existing) {
    const [updated] = await db.update(orgSettings)
      .set({ value: JSON.stringify(value), updatedAt: new Date() })
      .where(eq(orgSettings.id, existing.id))
      .returning();
    return c.json(updated);
  }

  const [created] = await db.insert(orgSettings)
    .values({ orgId: systemOrg.id, key, value: JSON.stringify(value) })
    .returning();

  return c.json(created, 201);
});

export { adminSettingsRoutes };
