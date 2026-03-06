import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { agentService } from "../services/agent.service";
import { auditService } from "../services/audit.service";
import { parsePagination } from "@nova/shared/utils";
import { AppError } from "@nova/shared/utils";

const agentRoutes = new Hono<AppContext>();

agentRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const { limit, offset } = parsePagination(c.req.query());
  const search = c.req.query("search");

  const result = await agentService.list(orgId, { search, limit, offset });
  return c.json(result);
});

agentRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const agent = await agentService.get(orgId, c.req.param("id"));
  return c.json(agent);
});

const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(100_000).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(200_000).optional(),
});

agentRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = createAgentSchema.parse(await c.req.json());

  const agent = await agentService.create(orgId, userId, body);
  await auditService.writeAuditLog({ orgId, userId, action: "agent.create", resourceType: "agent", resourceId: agent.id });
  return c.json(agent, 201);
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(100_000).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(200_000).optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

agentRoutes.patch("/:id", async (c) => {
  const orgId = c.get("orgId");
  const body = updateAgentSchema.parse(await c.req.json());
  const agent = await agentService.update(orgId, c.req.param("id"), body);
  return c.json(agent);
});

agentRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  await agentService.delete(orgId, c.req.param("id"));
  await auditService.writeAuditLog({ orgId, userId, action: "agent.delete", resourceType: "agent", resourceId: c.req.param("id") });
  return c.body(null, 204);
});

export { agentRoutes };
