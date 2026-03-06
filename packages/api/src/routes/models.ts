import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { models, modelProviders } from "@nova/shared/schemas";
import { requireRole } from "../middleware/rbac";

const modelRoutes = new Hono<AppContext>();

modelRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(models).where(and(eq(models.orgId, orgId), eq(models.isEnabled, true)));
  return c.json({ data: result });
});

modelRoutes.get("/providers", async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(modelProviders).where(eq(modelProviders.orgId, orgId));
  return c.json({ data: result });
});

const createProviderSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  apiBaseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
});

modelRoutes.post("/providers", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = createProviderSchema.parse(await c.req.json());
  const [provider] = await db.insert(modelProviders).values({
    orgId,
    name: body.name,
    type: body.type,
    apiBaseUrl: body.apiBaseUrl,
    apiKeyEncrypted: body.apiKey,
  }).returning();
  return c.json(provider, 201);
});

const createModelSchema = z.object({
  modelProviderId: z.string().uuid(),
  name: z.string().min(1).max(200),
  modelIdExternal: z.string().min(1),
  contextWindow: z.number().int().optional(),
  capabilities: z.array(z.string()).optional(),
});

modelRoutes.post("/", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = createModelSchema.parse(await c.req.json());
  const [model] = await db.insert(models).values({
    orgId,
    modelProviderId: body.modelProviderId,
    name: body.name,
    modelIdExternal: body.modelIdExternal,
    contextWindow: body.contextWindow,
    capabilities: body.capabilities ?? [],
  }).returning();
  return c.json(model, 201);
});

modelRoutes.patch("/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    name: z.string().optional(),
    isEnabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    isFallback: z.boolean().optional(),
    fallbackOrder: z.number().int().nullable().optional(),
  }).parse(await c.req.json());

  // If setting as default, clear existing default first
  if (body.isDefault === true) {
    await db.update(models)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(models.orgId, orgId), eq(models.isDefault, true)));
  }

  const [model] = await db.update(models)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(models.id, c.req.param("id")), eq(models.orgId, orgId)))
    .returning();

  return c.json(model);
});

// Bulk update fallback order
const fallbackOrderSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    fallbackOrder: z.number().int().min(0),
    isFallback: z.boolean(),
  })),
});

modelRoutes.put("/fallback-order", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = fallbackOrderSchema.parse(await c.req.json());

  // First clear all fallback flags for this org
  await db.update(models)
    .set({ isFallback: false, fallbackOrder: null, updatedAt: new Date() })
    .where(eq(models.orgId, orgId));

  // Set the new order
  for (const item of body.order) {
    await db.update(models)
      .set({ isFallback: item.isFallback, fallbackOrder: item.fallbackOrder, updatedAt: new Date() })
      .where(and(eq(models.id, item.id), eq(models.orgId, orgId)));
  }

  const result = await db.select().from(models).where(eq(models.orgId, orgId));
  return c.json({ data: result });
});

// Get all models including disabled ones (admin view)
modelRoutes.get("/all", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(models).where(eq(models.orgId, orgId));
  return c.json({ data: result });
});

export { modelRoutes };
