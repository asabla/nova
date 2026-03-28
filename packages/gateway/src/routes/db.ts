import { Hono } from "hono";
import { eq, and, desc, isNull, asc } from "drizzle-orm";
import type { GatewayEnv } from "../app";
import { db } from "@nova/worker-shared/db";
import {
  conversations,
  messages,
  agents,
  agentMemoryEntries,
  workflows,
  customWorkers,
} from "@nova/shared/schemas";

export const dbRoutes = new Hono<GatewayEnv>();

// --- Conversations ---

dbRoutes.get("/conversations/:id", async (c) => {
  const orgId = c.get("orgId");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId), isNull(conversations.deletedAt)))
    .limit(1);

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// --- Messages ---

dbRoutes.get("/messages", async (c) => {
  const orgId = c.get("orgId");
  const conversationId = c.req.query("conversationId");
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);

  if (!conversationId) return c.json({ error: "conversationId required" }, 400);

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.orgId, orgId),
        isNull(messages.deletedAt),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json(rows);
});

dbRoutes.post("/messages", async (c) => {
  const orgId = c.get("orgId");
  const body = await c.req.json();

  const [row] = await db
    .insert(messages)
    .values({
      ...body,
      orgId,
    })
    .returning();

  return c.json(row, 201);
});

dbRoutes.patch("/messages/:id", async (c) => {
  const orgId = c.get("orgId");
  const id = c.req.param("id");
  const body = await c.req.json();

  const [row] = await db
    .update(messages)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(messages.id, id), eq(messages.orgId, orgId)))
    .returning();

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// --- Agents ---

dbRoutes.get("/agents/:id", async (c) => {
  const orgId = c.get("orgId");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.orgId, orgId), isNull(agents.deletedAt)))
    .limit(1);

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// --- Agent Memory ---

dbRoutes.get("/agent-memory", async (c) => {
  const orgId = c.get("orgId");
  const agentId = c.req.query("agentId");
  const scope = c.req.query("scope");

  if (!agentId) return c.json({ error: "agentId required" }, 400);

  const conditions = [
    eq(agentMemoryEntries.agentId, agentId),
    eq(agentMemoryEntries.orgId, orgId),
    isNull(agentMemoryEntries.deletedAt),
  ];
  if (scope) conditions.push(eq(agentMemoryEntries.scope, scope));

  const rows = await db
    .select()
    .from(agentMemoryEntries)
    .where(and(...conditions))
    .orderBy(desc(agentMemoryEntries.createdAt));

  return c.json(rows);
});

dbRoutes.post("/agent-memory", async (c) => {
  const orgId = c.get("orgId");
  const body = await c.req.json();

  const [row] = await db
    .insert(agentMemoryEntries)
    .values({ ...body, orgId })
    .returning();

  return c.json(row, 201);
});

// --- Workflows ---

dbRoutes.patch("/workflows/:id", async (c) => {
  const orgId = c.get("orgId");
  const id = c.req.param("id");
  const body = await c.req.json();

  const [row] = await db
    .update(workflows)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(workflows.id, id), eq(workflows.orgId, orgId)))
    .returning();

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// --- Custom Workers (internal lookup) ---

dbRoutes.get("/custom-workers/:id", async (c) => {
  const orgId = c.get("orgId");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(customWorkers)
    .where(and(eq(customWorkers.id, id), eq(customWorkers.orgId, orgId), isNull(customWorkers.deletedAt)))
    .limit(1);

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});
