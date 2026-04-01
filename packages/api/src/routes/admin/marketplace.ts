import { Hono } from "hono";
import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { agents, organisations, promptTemplates, models } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";
import { agentService } from "../../services/agent.service";
import { promptService } from "../../services/prompt.service";

const adminMarketplaceRoutes = new Hono<AppContext>();

async function getSystemOrg() {
  const [systemOrg] = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isSystemOrg, true));
  if (!systemOrg) throw AppError.notFound("System organisation not configured");
  return systemOrg;
}

// ─── Validation schemas ──────────────────────────────────────────────

const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(100_000).optional(),
  modelId: z.union([z.string().uuid(), z.literal("")]).optional().transform((v) => v || undefined),
  visibility: z.enum(["private", "team", "org", "public"]).optional(),
  isPublished: z.boolean().optional(),
  avatarUrl: z.string().max(500).optional(),
  toolApprovalMode: z.enum(["auto", "always-ask", "never"]).optional(),
  starters: z.array(z.string()).optional(),
  defaultTier: z.enum(["", "direct", "sequential", "orchestrated"]).optional(),
  effortLevel: z.enum(["low", "medium", "high"]).optional(),
});

const updateAgentSchema = createAgentSchema.partial().extend({
  modelId: z.string().uuid().nullable().optional().or(z.literal("")),
});

const testAgentSchema = z.object({
  prompt: z.string().min(1).max(5000),
  systemPrompt: z.string().max(100_000).optional(),
  modelId: z.string().optional(),
  modelParams: z.record(z.unknown()).optional(),
});

const generatePromptSchema = z.object({
  modelId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  currentPrompt: z.string().optional(),
  starters: z.array(z.string()).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  content: z.string().min(1).max(100_000),
  systemPrompt: z.string().max(100_000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  visibility: z.enum(["private", "team", "org"]).optional(),
  inputs: z.array(z.object({
    id: z.string(),
    type: z.enum(["text", "textarea", "file"]),
    label: z.string(),
    placeholder: z.string(),
    required: z.boolean(),
    accept: z.string().optional(),
  })).max(10).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  bgColor: z.string().max(50).optional(),
});

const updateTemplateSchema = createTemplateSchema.partial().extend({
  isPublished: z.boolean().optional(),
});

function mergeModelParams(
  data: { defaultTier?: string; effortLevel?: string; [key: string]: unknown },
) {
  const { defaultTier, effortLevel, ...rest } = data;
  const modelParams: Record<string, unknown> = {};
  if (defaultTier) modelParams.defaultTier = defaultTier;
  if (effortLevel && effortLevel !== "medium") modelParams.effortLevel = effortLevel;
  return { ...rest, ...(Object.keys(modelParams).length > 0 ? { modelParams } : {}) };
}

// ─── Agent endpoints ─────────────────────────────────────────────────

// List system org agents (marketplace catalog)
adminMarketplaceRoutes.get("/agents", async (c) => {
  const systemOrg = await getSystemOrg();

  const result = await db
    .select()
    .from(agents)
    .where(and(eq(agents.orgId, systemOrg.id), isNull(agents.deletedAt)))
    .orderBy(desc(agents.updatedAt));

  return c.json({ data: result, systemOrgId: systemOrg.id });
});

// Test agent (non-streaming LLM call, works for unsaved agents)
// Registered before :agentId routes so Hono doesn't capture "test" as a param
adminMarketplaceRoutes.post("/agents/test", async (c) => {
  const systemOrg = await getSystemOrg();
  const { prompt, systemPrompt, modelId, modelParams } = testAgentSchema.parse(await c.req.json());

  const { chatCompletion, resolveModelExternalId } = await import("../../lib/litellm");
  const resolvedModel = await resolveModelExternalId(systemOrg.id, modelId || null);

  const messages: { role: "system" | "user"; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  try {
    const result = await chatCompletion({
      model: resolvedModel,
      messages,
      ...(modelParams ?? {}),
      orgId: systemOrg.id,
    });
    const choice = result.choices?.[0];
    return c.json({
      content: choice?.message?.content ?? "",
      model: result.model,
      usage: result.usage,
    });
  } catch (err: any) {
    return c.json({ error: err.message ?? "LLM call failed" }, 502);
  }
});

// Generate/improve agent system prompt with AI
adminMarketplaceRoutes.post("/agents/generate-prompt", async (c) => {
  const systemOrg = await getSystemOrg();
  const { modelId, name, description, currentPrompt, starters } = generatePromptSchema.parse(await c.req.json());

  const { chatCompletion, resolveModelExternalId } = await import("../../lib/litellm");
  const resolvedModel = await resolveModelExternalId(systemOrg.id, modelId || null);

  const hasExisting = !!currentPrompt?.trim();
  const needsName = !name?.trim();
  const needsDescription = !description?.trim();
  const needsStarters = !starters?.filter(Boolean).length;
  const needsJson = needsName || needsDescription || needsStarters;

  let metaPrompt: string;
  if (hasExisting) {
    metaPrompt = `You are an expert at crafting AI agent system prompts. Improve the following system prompt${name ? ` for an agent named "${name}"` : ""}${description ? ` (${description})` : ""}. Make it more specific, structured, and effective while preserving the user's intent.\n\nCurrent prompt:\n${currentPrompt}`;
  } else {
    const context = name && description
      ? `for an AI agent named "${name}" that ${description}`
      : name
        ? `for an AI agent named "${name}"`
        : "for a general-purpose AI agent";
    metaPrompt = `You are an expert at crafting AI agent system prompts. Create a detailed, well-structured system prompt ${context}. The prompt should clearly define the agent's role, capabilities, tone, and behavior guidelines.`;
  }

  if (needsJson) {
    const fields: string[] = ['"systemPrompt": "the system prompt"'];
    if (needsName) fields.push('"name": "short agent name (2-4 words)"');
    if (needsDescription) fields.push('"description": "one-sentence summary"');
    if (needsStarters) fields.push('"starters": ["4 short conversation starter prompts"]');
    metaPrompt += `\n\nRespond with a JSON object: { ${fields.join(", ")} }.`;
  } else {
    metaPrompt += ` Return ONLY the ${hasExisting ? "improved prompt" : "system prompt"}, no explanation.`;
  }

  try {
    const result = await chatCompletion({
      model: resolvedModel,
      messages: [{ role: "user", content: metaPrompt }],
      orgId: systemOrg.id,
    });
    const content = result.choices?.[0]?.message?.content ?? "";
    return c.json({ content });
  } catch (err: any) {
    return c.json({ error: err.message ?? "Generation failed" }, 502);
  }
});

// Get single agent detail
adminMarketplaceRoutes.get("/agents/:agentId", async (c) => {
  const systemOrg = await getSystemOrg();
  const agent = await agentService.get(systemOrg.id, c.req.param("agentId"));
  return c.json(agent);
});

// Create agent in system org
adminMarketplaceRoutes.post("/agents", async (c) => {
  const systemOrg = await getSystemOrg();
  const userId = c.get("userId");
  const parsed = createAgentSchema.parse(await c.req.json());
  const body = mergeModelParams(parsed);

  const agent = await agentService.create(systemOrg.id, userId, body as any);
  return c.json(agent, 201);
});

// Update agent
adminMarketplaceRoutes.patch("/agents/:agentId", async (c) => {
  const systemOrg = await getSystemOrg();
  const raw = await c.req.json();
  const result = updateAgentSchema.safeParse(raw);
  if (!result.success) {
    return c.json({ error: "Validation failed", issues: result.error.issues }, 400);
  }

  const { defaultTier, effortLevel, ...parsed } = result.data;
  const data: Record<string, unknown> = { ...parsed };

  if (data.modelId === "") data.modelId = null;

  if (defaultTier !== undefined || effortLevel !== undefined) {
    data.modelParams = {
      ...((data.modelParams as Record<string, unknown>) ?? {}),
      ...(defaultTier !== undefined ? { defaultTier: defaultTier || undefined } : {}),
      ...(effortLevel !== undefined ? { effortLevel: effortLevel === "medium" ? undefined : effortLevel } : {}),
    };
  }

  const agent = await agentService.update(systemOrg.id, c.req.param("agentId"), data as any);
  return c.json(agent);
});

// Delete agent (soft-delete)
adminMarketplaceRoutes.delete("/agents/:agentId", async (c) => {
  const systemOrg = await getSystemOrg();
  await agentService.delete(systemOrg.id, c.req.param("agentId"));
  return c.body(null, 204);
});

// List models available to system org (for form dropdowns)
adminMarketplaceRoutes.get("/models", async (c) => {
  const systemOrg = await getSystemOrg();

  const result = await db
    .select({
      id: models.id,
      name: models.name,
      modelIdExternal: models.modelIdExternal,
      isDefault: models.isDefault,
    })
    .from(models)
    .where(and(eq(models.orgId, systemOrg.id), eq(models.isEnabled, true), isNull(models.deletedAt)))
    .orderBy(models.name);

  return c.json({ data: result });
});

// ─── Template endpoints ──────────────────────────────────────────────

// List system org prompt templates
adminMarketplaceRoutes.get("/templates", async (c) => {
  const systemOrg = await getSystemOrg();

  const result = await db
    .select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.orgId, systemOrg.id), isNull(promptTemplates.deletedAt)))
    .orderBy(desc(promptTemplates.updatedAt));

  return c.json({ data: result, systemOrgId: systemOrg.id });
});

// Get single template
adminMarketplaceRoutes.get("/templates/:templateId", async (c) => {
  const systemOrg = await getSystemOrg();
  const template = await promptService.get(systemOrg.id, c.req.param("templateId"));
  return c.json(template);
});

// Create template in system org
adminMarketplaceRoutes.post("/templates", async (c) => {
  const systemOrg = await getSystemOrg();
  const userId = c.get("userId");
  const parsed = createTemplateSchema.parse(await c.req.json());

  const template = await promptService.create(systemOrg.id, userId, parsed);

  // Mark as system template
  await db.update(promptTemplates)
    .set({ isSystem: true })
    .where(eq(promptTemplates.id, template.id));

  return c.json({ ...template, isSystem: true }, 201);
});

// Update template
adminMarketplaceRoutes.patch("/templates/:templateId", async (c) => {
  const systemOrg = await getSystemOrg();
  const raw = await c.req.json();
  const result = updateTemplateSchema.safeParse(raw);
  if (!result.success) {
    return c.json({ error: "Validation failed", issues: result.error.issues }, 400);
  }

  // Direct DB update since promptService.update doesn't cover all fields
  const [updated] = await db.update(promptTemplates)
    .set({ ...result.data, updatedAt: new Date() })
    .where(and(eq(promptTemplates.id, c.req.param("templateId")), eq(promptTemplates.orgId, systemOrg.id)))
    .returning();

  if (!updated) throw AppError.notFound("Template not found");
  return c.json(updated);
});

// Delete template (soft-delete)
adminMarketplaceRoutes.delete("/templates/:templateId", async (c) => {
  const systemOrg = await getSystemOrg();

  const [deleted] = await db.update(promptTemplates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(promptTemplates.id, c.req.param("templateId")), eq(promptTemplates.orgId, systemOrg.id)))
    .returning();

  if (!deleted) throw AppError.notFound("Template not found");
  return c.body(null, 204);
});

export { adminMarketplaceRoutes };
