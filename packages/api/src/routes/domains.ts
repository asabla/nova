import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { domainService } from "../services/domain.service";
import { writeAuditLog } from "../services/audit.service";

const domainRoutes = new Hono<AppContext>();

// List all domain rules
domainRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const rules = await domainService.listRules(orgId);
  return c.json({ data: rules });
});

// Add a domain rule
const addRuleSchema = z.object({
  domain: z.string().min(1).max(255),
  type: z.enum(["allow", "block"]),
  reason: z.string().max(500).optional(),
});

domainRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = addRuleSchema.parse(await c.req.json());
  const rule = await domainService.addRule(orgId, userId, body);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "domain.rule.create", resourceType: "domain_rule", resourceId: rule.id });
  return c.json(rule, 201);
});

// Remove a domain rule
domainRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const ruleId = c.req.param("id");
  await domainService.removeRule(orgId, ruleId);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "domain.rule.delete", resourceType: "domain_rule", resourceId: ruleId });
  return c.body(null, 204);
});

// Check if a URL is allowed
const checkUrlSchema = z.object({
  url: z.string().url(),
});

domainRoutes.post("/check", async (c) => {
  const orgId = c.get("orgId");
  const body = checkUrlSchema.parse(await c.req.json());
  const result = await domainService.checkUrl(orgId, body.url);
  return c.json(result);
});

export { domainRoutes };
