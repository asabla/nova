import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { agentService } from "../services/agent.service";
import { writeAuditLog } from "../services/audit.service";
import { parsePagination } from "@nova/shared/utils";

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
  modelId: z.string().uuid().optional(),
  modelParams: z.record(z.unknown()).optional(),
});

agentRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = createAgentSchema.parse(await c.req.json());

  const agent = await agentService.create(orgId, userId, body);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "agent.create", resourceType: "agent", resourceId: agent.id });
  return c.json(agent, 201);
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(100_000).optional(),
  modelId: z.string().uuid().optional(),
  modelParams: z.record(z.unknown()).optional(),
  visibility: z.enum(["private", "team", "org", "public"]).optional(),
  isPublished: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  toolApprovalMode: z.enum(["auto", "always-ask", "never"]).optional(),
  memoryScope: z.enum(["per-user", "per-conversation", "global"]).optional(),
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
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "agent.delete", resourceType: "agent", resourceId: c.req.param("id") });
  return c.body(null, 204);
});

export { agentRoutes };
