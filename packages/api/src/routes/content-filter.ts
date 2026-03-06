import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { contentFilters, dlpRules } from "@nova/shared/schemas";
import { eq, and, isNull } from "drizzle-orm";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

const contentFilterRoutes = new Hono<AppContext>();

// === Content Filters ===

contentFilterRoutes.get("/filters", async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(contentFilters)
    .where(and(eq(contentFilters.orgId, orgId), isNull(contentFilters.deletedAt)));
  return c.json(result);
});

const filterSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["keyword", "regex", "category"]),
  pattern: z.string().max(5000).optional(),
  action: z.enum(["block", "warn", "flag", "redact"]),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  isEnabled: z.boolean().optional(),
});

contentFilterRoutes.post("/filters", zValidator("json", filterSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const [filter] = await db.insert(contentFilters).values({
    orgId,
    ...data,
  }).returning();

  await writeAuditLog({
    orgId, actorId: userId, actorType: "user",
    action: "content_filter.create", resourceType: "content_filter", resourceId: filter.id,
  });

  return c.json(filter, 201);
});

contentFilterRoutes.patch("/filters/:id", zValidator("json", filterSchema.partial()), async (c) => {
  const orgId = c.get("orgId");
  const data = c.req.valid("json");

  const [filter] = await db.update(contentFilters)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(contentFilters.id, c.req.param("id")), eq(contentFilters.orgId, orgId)))
    .returning();

  if (!filter) throw AppError.notFound("Content filter");
  return c.json(filter);
});

contentFilterRoutes.delete("/filters/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const [filter] = await db.update(contentFilters)
    .set({ deletedAt: new Date() })
    .where(and(eq(contentFilters.id, c.req.param("id")), eq(contentFilters.orgId, orgId)))
    .returning();

  if (!filter) throw AppError.notFound("Content filter");

  await writeAuditLog({
    orgId, actorId: userId, actorType: "user",
    action: "content_filter.delete", resourceType: "content_filter", resourceId: filter.id,
  });

  return c.json({ ok: true });
});

// === DLP Rules ===

contentFilterRoutes.get("/dlp", async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(dlpRules)
    .where(and(eq(dlpRules.orgId, orgId), isNull(dlpRules.deletedAt)));
  return c.json(result);
});

const dlpSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  detectorType: z.enum(["regex", "keyword", "ner", "pii"]),
  pattern: z.string().max(5000).optional(),
  keywords: z.array(z.string()).optional(),
  action: z.enum(["block", "redact", "warn", "log"]),
  appliesTo: z.enum(["input", "output", "both"]).optional(),
  isEnabled: z.boolean().optional(),
});

contentFilterRoutes.post("/dlp", zValidator("json", dlpSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const [rule] = await db.insert(dlpRules).values({
    orgId,
    ...data,
  }).returning();

  await writeAuditLog({
    orgId, actorId: userId, actorType: "user",
    action: "dlp_rule.create", resourceType: "dlp_rule", resourceId: rule.id,
  });

  return c.json(rule, 201);
});

contentFilterRoutes.patch("/dlp/:id", zValidator("json", dlpSchema.partial()), async (c) => {
  const orgId = c.get("orgId");
  const data = c.req.valid("json");

  const [rule] = await db.update(dlpRules)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(dlpRules.id, c.req.param("id")), eq(dlpRules.orgId, orgId)))
    .returning();

  if (!rule) throw AppError.notFound("DLP rule");
  return c.json(rule);
});

contentFilterRoutes.delete("/dlp/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const [rule] = await db.update(dlpRules)
    .set({ deletedAt: new Date() })
    .where(and(eq(dlpRules.id, c.req.param("id")), eq(dlpRules.orgId, orgId)))
    .returning();

  if (!rule) throw AppError.notFound("DLP rule");

  await writeAuditLog({
    orgId, actorId: userId, actorType: "user",
    action: "dlp_rule.delete", resourceType: "dlp_rule", resourceId: rule.id,
  });

  return c.json({ ok: true });
});

export { contentFilterRoutes };
