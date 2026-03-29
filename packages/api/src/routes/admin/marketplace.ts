import { Hono } from "hono";
import { eq, and, isNull, desc } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { agents, organisations, promptTemplates } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

const adminMarketplaceRoutes = new Hono<AppContext>();

// List system org agents (marketplace catalog)
adminMarketplaceRoutes.get("/agents", async (c) => {
  const [systemOrg] = await db.select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isSystemOrg, true));

  if (!systemOrg) return c.json({ data: [] });

  const result = await db.select()
    .from(agents)
    .where(and(eq(agents.orgId, systemOrg.id), isNull(agents.deletedAt)))
    .orderBy(desc(agents.updatedAt));

  return c.json({ data: result, systemOrgId: systemOrg.id });
});

// Publish/unpublish a system org agent
adminMarketplaceRoutes.patch("/agents/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const body = await c.req.json();

  const [agent] = await db.update(agents)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(agents.id, agentId))
    .returning();

  if (!agent) throw AppError.notFound("Agent");
  return c.json(agent);
});

// List system org prompt templates
adminMarketplaceRoutes.get("/templates", async (c) => {
  const [systemOrg] = await db.select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isSystemOrg, true));

  if (!systemOrg) return c.json({ data: [] });

  const result = await db.select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.orgId, systemOrg.id), isNull(promptTemplates.deletedAt)))
    .orderBy(desc(promptTemplates.updatedAt));

  return c.json({ data: result, systemOrgId: systemOrg.id });
});

export { adminMarketplaceRoutes };
