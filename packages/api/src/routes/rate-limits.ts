import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { rateLimitRules } from "@nova/shared/schemas";
import { eq, and, isNull } from "drizzle-orm";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

const rateLimitRoutes = new Hono<AppContext>();

rateLimitRoutes.get("/rate-limits", async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(rateLimitRules)
    .where(and(eq(rateLimitRules.orgId, orgId), isNull(rateLimitRules.deletedAt)));
  return c.json(result);
});

const ruleSchema = z.object({
  scope: z.enum(["user", "group", "org", "api-key", "ip"]),
  targetId: z.string().uuid().optional(),
  windowSeconds: z.number().int().min(1).max(86400),
  maxRequests: z.number().int().min(1).max(100000),
  maxTokens: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
});

rateLimitRoutes.post("/rate-limits", zValidator("json", ruleSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const [rule] = await db.insert(rateLimitRules).values({
    orgId,
    ...data,
  }).returning();

  await writeAuditLog({
    orgId, actorId: userId, actorType: "user",
    action: "rate_limit.create", resourceType: "rate_limit_rule", resourceId: rule.id,
  });

  return c.json(rule, 201);
});

rateLimitRoutes.patch("/rate-limits/:id", zValidator("json", ruleSchema.partial()), async (c) => {
  const orgId = c.get("orgId");
  const data = c.req.valid("json");

  const [rule] = await db.update(rateLimitRules)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(rateLimitRules.id, c.req.param("id")), eq(rateLimitRules.orgId, orgId)))
    .returning();

  if (!rule) throw AppError.notFound("Rate limit rule");
  return c.json(rule);
});

rateLimitRoutes.delete("/rate-limits/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const [rule] = await db.update(rateLimitRules)
    .set({ deletedAt: new Date() })
    .where(and(eq(rateLimitRules.id, c.req.param("id")), eq(rateLimitRules.orgId, orgId)))
    .returning();

  if (!rule) throw AppError.notFound("Rate limit rule");

  await writeAuditLog({
    orgId, actorId: userId, actorType: "user",
    action: "rate_limit.delete", resourceType: "rate_limit_rule", resourceId: rule.id,
  });

  return c.json({ ok: true });
});

export { rateLimitRoutes };
