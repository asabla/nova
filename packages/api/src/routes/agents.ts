import { Hono } from "hono";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { agentService } from "../services/agent.service";
import { writeAuditLog } from "../services/audit.service";
import { parsePagination, AppError } from "@nova/shared/utils";
import { db } from "../lib/db";
import { agentStarterTemplates, promptTemplates } from "@nova/shared/schemas";

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
  modelId: z.union([z.string().uuid(), z.literal("")]).optional().transform((v) => v || undefined),
  modelParams: z.record(z.unknown()).optional(),
  visibility: z.enum(["private", "team", "org", "public"]).optional(),
  toolApprovalMode: z.enum(["auto", "always-ask", "never"]).optional(),
  memoryScope: z.enum(["per-user", "per-conversation", "global"]).optional(),
  maxSteps: z.number().int().min(1).max(100).optional(),
  timeoutSeconds: z.number().int().min(1).max(3600).optional(),
  starters: z.array(z.string()).optional(),
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

// Clone agent
agentRoutes.post("/:id/clone", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const original = await agentService.get(orgId, c.req.param("id"));
  if (!original) throw AppError.notFound("Agent not found");

  const clone = await agentService.create(orgId, userId, {
    name: `${original.name} (Copy)`,
    description: original.description ?? undefined,
    systemPrompt: original.systemPrompt ?? undefined,
    modelId: original.modelId ?? undefined,
    modelParams: original.modelParams as Record<string, unknown> | undefined,
  });

  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "agent.clone", resourceType: "agent", resourceId: clone.id, details: { sourceAgentId: c.req.param("id") } });
  return c.json(clone, 201);
});

// Set webhook URL
agentRoutes.patch("/:id/webhook", async (c) => {
  const orgId = c.get("orgId");
  const { webhookUrl } = z.object({ webhookUrl: z.string().url().nullable() }).parse(await c.req.json());
  const agent = await agentService.update(orgId, c.req.param("id"), { webhookUrl });
  return c.json(agent);
});

// Set cron schedule
agentRoutes.patch("/:id/schedule", async (c) => {
  const orgId = c.get("orgId");
  const { cronSchedule } = z.object({ cronSchedule: z.string().max(100).nullable() }).parse(await c.req.json());
  const agent = await agentService.update(orgId, c.req.param("id"), { cronSchedule });
  return c.json(agent);
});

// Trigger agent execution manually
agentRoutes.post("/:id/trigger", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { input } = z.object({ input: z.string().optional() }).parse(await c.req.json());

  const agent = await agentService.get(orgId, c.req.param("id"));
  if (!agent) throw AppError.notFound("Agent not found");

  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "agent.trigger", resourceType: "agent", resourceId: agent.id });

  return c.json({
    status: "triggered",
    agentId: agent.id,
    message: "Agent execution queued. Results will appear in a new conversation.",
  });
});

// List published agents (marketplace)
agentRoutes.get("/marketplace/browse", async (c) => {
  const orgId = c.get("orgId");
  const search = c.req.query("search");
  const category = c.req.query("category");
  const result = await agentService.listPublished(orgId, { search, category });
  return c.json(result);
});

// Publish agent to marketplace
agentRoutes.post("/:id/publish", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const visibility = body.visibility ?? "org";
  const agent = await agentService.update(orgId, c.req.param("id"), { isPublished: true, visibility });
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "agent.publish", resourceType: "agent", resourceId: c.req.param("id") });
  return c.json(agent);
});

// Unpublish agent
agentRoutes.post("/:id/unpublish", async (c) => {
  const orgId = c.get("orgId");
  const agent = await agentService.update(orgId, c.req.param("id"), { isPublished: false });
  return c.json(agent);
});

// Install a marketplace agent into the caller's org (cross-org clone from system org)
agentRoutes.post("/marketplace/:id/install", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const agentId = c.req.param("id");
  const clonedAgent = await agentService.installFromMarketplace(agentId, orgId, userId);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "agent.install", resourceType: "agent", resourceId: clonedAgent.id, details: { sourceAgentId: agentId } });
  return c.json(clonedAgent, 201);
});

// Create a version snapshot
agentRoutes.post("/:id/version", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const agent = await agentService.get(orgId, c.req.param("id"));
  if (!agent) throw AppError.notFound("Agent not found");

  const { description } = z.object({ description: z.string().max(500).optional() }).parse(await c.req.json());

  const version = await agentService.createVersion(orgId, c.req.param("id"), {
    description,
    snapshot: {
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      modelId: agent.modelId,
      modelParams: agent.modelParams,
      toolApprovalMode: agent.toolApprovalMode,
      memoryScope: agent.memoryScope,
    },
    createdBy: userId,
  });

  return c.json(version, 201);
});

// List versions
agentRoutes.get("/:id/versions", async (c) => {
  const orgId = c.get("orgId");
  const versions = await agentService.listVersions(orgId, c.req.param("id"));
  return c.json({ data: versions });
});

// Test agent with sample prompt
agentRoutes.post("/:id/test", async (c) => {
  const orgId = c.get("orgId");
  const agent = await agentService.get(orgId, c.req.param("id"));
  if (!agent) throw AppError.notFound("Agent not found");

  const { prompt } = z.object({ prompt: z.string().min(1).max(5000) }).parse(await c.req.json());

  // Use litellm to run a test completion with agent's system prompt
  const { chatCompletion } = await import("../lib/litellm");
  const messages = [];
  if (agent.systemPrompt) messages.push({ role: "system" as const, content: agent.systemPrompt });
  messages.push({ role: "user" as const, content: prompt });

  try {
    const result = await chatCompletion({
      model: agent.modelId ?? "default",
      messages,
      ...(agent.modelParams as Record<string, unknown> ?? {}),
      orgId,
    });
    return c.json({
      content: result.choices?.[0]?.message?.content ?? "",
      model: result.model,
      usage: result.usage,
    });
  } catch (err: any) {
    return c.json({ error: err.message ?? "Test failed" }, 500);
  }
});

// Bulk operations (admin)
const bulkAgentSchema = z.object({
  agentIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["enable", "disable", "reassign"]),
  newOwnerId: z.string().uuid().optional(),
});

agentRoutes.post("/bulk", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { agentIds, action, newOwnerId } = bulkAgentSchema.parse(await c.req.json());

  const results = await Promise.allSettled(
    agentIds.map(async (agentId) => {
      if (action === "enable") {
        await agentService.update(orgId, agentId, { isEnabled: true });
      } else if (action === "disable") {
        await agentService.update(orgId, agentId, { isEnabled: false });
      } else if (action === "reassign" && newOwnerId) {
        await agentService.update(orgId, agentId, { ownerId: newOwnerId });
      }
      return agentId;
    }),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  await writeAuditLog({
    orgId, actorId: userId, actorType: "user",
    action: `agent.bulk.${action}`,
    resourceType: "agent",
    details: { agentIds, succeeded, failed },
  });

  return c.json({ succeeded, failed, total: agentIds.length });
});

// --- Starter Templates ---

agentRoutes.get("/:id/starters", async (c) => {
  const orgId = c.get("orgId");
  const agentId = c.req.param("id");

  const rows = await db
    .select({
      id: agentStarterTemplates.id,
      promptTemplateId: agentStarterTemplates.promptTemplateId,
      sortOrder: agentStarterTemplates.sortOrder,
      template: promptTemplates,
    })
    .from(agentStarterTemplates)
    .innerJoin(promptTemplates, eq(agentStarterTemplates.promptTemplateId, promptTemplates.id))
    .where(and(eq(agentStarterTemplates.agentId, agentId), eq(agentStarterTemplates.orgId, orgId)))
    .orderBy(asc(agentStarterTemplates.sortOrder));

  return c.json({ data: rows.map((r) => ({ ...r.template, sortOrder: r.sortOrder })) });
});

agentRoutes.post("/:id/starters", async (c) => {
  const orgId = c.get("orgId");
  const agentId = c.req.param("id");
  const { promptTemplateId, sortOrder } = z.object({
    promptTemplateId: z.string().uuid(),
    sortOrder: z.number().int().min(0).optional(),
  }).parse(await c.req.json());

  const [row] = await db
    .insert(agentStarterTemplates)
    .values({ agentId, promptTemplateId, orgId, sortOrder: sortOrder ?? 0 })
    .onConflictDoNothing()
    .returning();

  return c.json(row ?? { agentId, promptTemplateId }, 201);
});

agentRoutes.delete("/:id/starters/:templateId", async (c) => {
  const orgId = c.get("orgId");
  const agentId = c.req.param("id");
  const templateId = c.req.param("templateId");

  await db
    .delete(agentStarterTemplates)
    .where(and(
      eq(agentStarterTemplates.agentId, agentId),
      eq(agentStarterTemplates.promptTemplateId, templateId),
      eq(agentStarterTemplates.orgId, orgId),
    ));

  return c.body(null, 204);
});

agentRoutes.patch("/:id/starters/reorder", async (c) => {
  const orgId = c.get("orgId");
  const agentId = c.req.param("id");
  const { templateIds } = z.object({
    templateIds: z.array(z.string().uuid()),
  }).parse(await c.req.json());

  await Promise.all(
    templateIds.map((id, index) =>
      db
        .update(agentStarterTemplates)
        .set({ sortOrder: index })
        .where(and(
          eq(agentStarterTemplates.agentId, agentId),
          eq(agentStarterTemplates.promptTemplateId, id),
          eq(agentStarterTemplates.orgId, orgId),
        )),
    ),
  );

  return c.json({ ok: true });
});

export { agentRoutes };
