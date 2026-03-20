import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { eq, and, desc, isNull, sql, ilike } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { agentMemoryEntries, agents } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

const memoryRoutes = new Hono<AppContext>();

// ---------------------------------------------------------------------------
// Helper: verify agent access
// ---------------------------------------------------------------------------
async function verifyAgentAccess(agentId: string, orgId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId), isNull(agents.deletedAt)));
  if (!agent) throw AppError.notFound("Agent");
  return agent;
}

// ---------------------------------------------------------------------------
// Memory Config (stored on the agent row)
// ---------------------------------------------------------------------------

memoryRoutes.get("/:agentId/memory/config", async (c) => {
  const orgId = c.get("orgId");
  const agent = await verifyAgentAccess(c.req.param("agentId"), orgId);

  return c.json({
    agentId: agent.id,
    memoryScope: agent.memoryScope,
    maxSteps: agent.maxSteps,
    isEnabled: agent.isEnabled,
  });
});

const updateConfigSchema = z.object({
  memoryScope: z.enum(["per-user", "per-conversation", "global"]).optional(),
  maxSteps: z.number().int().min(1).max(100).optional(),
});

memoryRoutes.patch("/:agentId/memory/config", zValidator("json", updateConfigSchema), async (c) => {
  const orgId = c.get("orgId");
  const agentId = c.req.param("agentId");
  const data = c.req.valid("json");

  await verifyAgentAccess(agentId, orgId);

  const [updated] = await db
    .update(agents)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
    .returning();

  return c.json({
    agentId: updated.id,
    memoryScope: updated.memoryScope,
    maxSteps: updated.maxSteps,
    isEnabled: updated.isEnabled,
  });
});

// ---------------------------------------------------------------------------
// Memory Export (must come before /:entryId param routes)
// ---------------------------------------------------------------------------

memoryRoutes.get("/:agentId/memory/export", async (c) => {
  const orgId = c.get("orgId");
  const agentId = c.req.param("agentId");

  await verifyAgentAccess(agentId, orgId);

  const entries = await db
    .select()
    .from(agentMemoryEntries)
    .where(and(
      eq(agentMemoryEntries.agentId, agentId),
      eq(agentMemoryEntries.orgId, orgId),
      isNull(agentMemoryEntries.deletedAt),
    ))
    .orderBy(agentMemoryEntries.key);

  c.header("Content-Disposition", `attachment; filename="agent-${agentId}-memory.json"`);
  return c.json({ agentId, exportedAt: new Date().toISOString(), entries });
});

// ---------------------------------------------------------------------------
// Memory Import
// ---------------------------------------------------------------------------

const importMemorySchema = z.object({
  entries: z.array(z.object({
    key: z.string().min(1).max(500),
    value: z.any(),
    scope: z.enum(["per-user", "per-conversation", "global"]),
  })).min(1).max(500),
});

memoryRoutes.post("/:agentId/memory/import", zValidator("json", importMemorySchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const agentId = c.req.param("agentId");
  const { entries } = c.req.valid("json");

  await verifyAgentAccess(agentId, orgId);

  const results = await db
    .insert(agentMemoryEntries)
    .values(entries.map((e) => ({
      agentId,
      orgId,
      userId: e.scope === "per-user" ? userId : undefined,
      scope: e.scope,
      key: e.key,
      value: e.value,
    })))
    .returning();

  return c.json({ imported: results.length });
});

// ---------------------------------------------------------------------------
// List memory entries for an agent (paginated)
// ---------------------------------------------------------------------------

memoryRoutes.get("/:agentId/memory", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const agentId = c.req.param("agentId");
  const search = c.req.query("search");
  const scope = c.req.query("scope");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const offset = Number(c.req.query("offset") ?? 0);

  const agent = await verifyAgentAccess(agentId, orgId);

  const conditions = [
    eq(agentMemoryEntries.agentId, agentId),
    eq(agentMemoryEntries.orgId, orgId),
    isNull(agentMemoryEntries.deletedAt),
  ];

  if (scope) conditions.push(eq(agentMemoryEntries.scope, scope));
  if (search) conditions.push(ilike(agentMemoryEntries.key, `%${search}%`));

  // For per-user scope, only show entries for the current user
  if (agent.memoryScope === "per-user") {
    conditions.push(eq(agentMemoryEntries.userId, userId));
  }

  const entries = await db
    .select()
    .from(agentMemoryEntries)
    .where(and(...conditions))
    .orderBy(desc(agentMemoryEntries.updatedAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentMemoryEntries)
    .where(and(...conditions));

  return c.json({ data: entries, total: count });
});

// ---------------------------------------------------------------------------
// Get a single memory entry
// ---------------------------------------------------------------------------

memoryRoutes.get("/:agentId/memory/:entryId", async (c) => {
  const orgId = c.get("orgId");
  const [entry] = await db
    .select()
    .from(agentMemoryEntries)
    .where(and(
      eq(agentMemoryEntries.id, c.req.param("entryId")),
      eq(agentMemoryEntries.agentId, c.req.param("agentId")),
      eq(agentMemoryEntries.orgId, orgId),
      isNull(agentMemoryEntries.deletedAt),
    ));

  if (!entry) throw AppError.notFound("Memory entry");
  return c.json(entry);
});

// ---------------------------------------------------------------------------
// Create or upsert a memory entry (used by agents at runtime)
// ---------------------------------------------------------------------------

const upsertMemorySchema = z.object({
  key: z.string().min(1).max(500),
  value: z.any(),
  scope: z.enum(["per-user", "per-conversation", "global"]),
  conversationId: z.string().uuid().optional(),
});

memoryRoutes.post("/:agentId/memory", zValidator("json", upsertMemorySchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const agentId = c.req.param("agentId");
  const { key, value, scope, conversationId } = c.req.valid("json");

  // Check if entry exists
  const conditions = [
    eq(agentMemoryEntries.agentId, agentId),
    eq(agentMemoryEntries.orgId, orgId),
    eq(agentMemoryEntries.key, key),
    eq(agentMemoryEntries.scope, scope),
    isNull(agentMemoryEntries.deletedAt),
  ];

  if (scope === "per-user") conditions.push(eq(agentMemoryEntries.userId, userId));
  if (scope === "per-conversation" && conversationId) {
    conditions.push(eq(agentMemoryEntries.conversationId, conversationId));
  }

  const [existing] = await db
    .select()
    .from(agentMemoryEntries)
    .where(and(...conditions));

  if (existing) {
    const [updated] = await db
      .update(agentMemoryEntries)
      .set({ value, updatedAt: new Date() })
      .where(eq(agentMemoryEntries.id, existing.id))
      .returning();
    return c.json(updated);
  }

  const [entry] = await db
    .insert(agentMemoryEntries)
    .values({
      agentId,
      orgId,
      userId: scope === "per-user" ? userId : undefined,
      conversationId: scope === "per-conversation" ? conversationId : undefined,
      scope,
      key,
      value,
    })
    .returning();

  return c.json(entry, 201);
});

// ---------------------------------------------------------------------------
// Edit a memory entry
// ---------------------------------------------------------------------------

const updateMemorySchema = z.object({
  key: z.string().min(1).max(500).optional(),
  value: z.any().optional(),
});

memoryRoutes.patch("/:agentId/memory/:entryId", zValidator("json", updateMemorySchema), async (c) => {
  const orgId = c.get("orgId");
  const data = c.req.valid("json");

  const [entry] = await db
    .update(agentMemoryEntries)
    .set({ ...data, updatedAt: new Date() })
    .where(and(
      eq(agentMemoryEntries.id, c.req.param("entryId")),
      eq(agentMemoryEntries.agentId, c.req.param("agentId")),
      eq(agentMemoryEntries.orgId, orgId),
      isNull(agentMemoryEntries.deletedAt),
    ))
    .returning();

  if (!entry) throw AppError.notFound("Memory entry");
  return c.json(entry);
});

// ---------------------------------------------------------------------------
// Delete a memory entry (soft delete)
// ---------------------------------------------------------------------------

memoryRoutes.delete("/:agentId/memory/:entryId", async (c) => {
  const orgId = c.get("orgId");
  const [entry] = await db
    .update(agentMemoryEntries)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(agentMemoryEntries.id, c.req.param("entryId")),
      eq(agentMemoryEntries.agentId, c.req.param("agentId")),
      eq(agentMemoryEntries.orgId, orgId),
      isNull(agentMemoryEntries.deletedAt),
    ))
    .returning();

  if (!entry) throw AppError.notFound("Memory entry");
  return c.json({ ok: true });
});

export { memoryRoutes };
