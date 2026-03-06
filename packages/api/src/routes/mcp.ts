import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { mcpServers, mcpTools } from "@nova/shared/schemas";
import { requireRole } from "../middleware/rbac";
import { AppError } from "@nova/shared/utils";

const mcpRoutes = new Hono<AppContext>();

mcpRoutes.get("/servers", async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(mcpServers)
    .where(eq(mcpServers.orgId, orgId))
    .orderBy(desc(mcpServers.createdAt));
  return c.json({ data: result });
});

mcpRoutes.get("/servers/:id", async (c) => {
  const orgId = c.get("orgId");
  const [server] = await db.select().from(mcpServers)
    .where(and(eq(mcpServers.id, c.req.param("id")), eq(mcpServers.orgId, orgId)));
  if (!server) throw AppError.notFound("MCP server not found");
  return c.json(server);
});

const addServerSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  description: z.string().max(2000).optional(),
  authType: z.enum(["none", "api_key", "oauth"]).optional(),
  authConfig: z.record(z.unknown()).optional(),
});

mcpRoutes.post("/servers", requireRole("power-user"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = addServerSchema.parse(await c.req.json());

  const [server] = await db.insert(mcpServers).values({
    orgId,
    addedBy: userId,
    name: body.name,
    url: body.url,
    description: body.description,
    authType: body.authType ?? "none",
    authConfig: body.authConfig,
    status: "pending",
  }).returning();

  return c.json(server, 201);
});

mcpRoutes.patch("/servers/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    name: z.string().optional(),
    url: z.string().url().optional(),
    isEnabled: z.boolean().optional(),
    isApproved: z.boolean().optional(),
    status: z.string().optional(),
  }).parse(await c.req.json());

  const [server] = await db.update(mcpServers)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(mcpServers.id, c.req.param("id")), eq(mcpServers.orgId, orgId)))
    .returning();

  if (!server) throw AppError.notFound("MCP server not found");
  return c.json(server);
});

mcpRoutes.delete("/servers/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  await db.delete(mcpTools).where(eq(mcpTools.serverId, c.req.param("id")));
  await db.delete(mcpServers).where(and(eq(mcpServers.id, c.req.param("id")), eq(mcpServers.orgId, orgId)));
  return c.body(null, 204);
});

// Test MCP server connectivity
mcpRoutes.post("/servers/:id/test", async (c) => {
  const orgId = c.get("orgId");
  const [server] = await db.select().from(mcpServers)
    .where(and(eq(mcpServers.id, c.req.param("id")), eq(mcpServers.orgId, orgId)));

  if (!server) throw AppError.notFound("MCP server not found");

  try {
    const resp = await fetch(server.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: {}, id: 1 }),
      signal: AbortSignal.timeout(10_000),
    });

    const isOk = resp.ok;
    await db.update(mcpServers)
      .set({ status: isOk ? "connected" : "error", lastTestedAt: new Date(), updatedAt: new Date() })
      .where(eq(mcpServers.id, server.id));

    return c.json({ connected: isOk, status: resp.status });
  } catch {
    await db.update(mcpServers)
      .set({ status: "error", lastTestedAt: new Date(), updatedAt: new Date() })
      .where(eq(mcpServers.id, server.id));

    return c.json({ connected: false, error: "Connection failed" });
  }
});

// List tools for an MCP server
mcpRoutes.get("/servers/:id/tools", async (c) => {
  const result = await db.select().from(mcpTools)
    .where(eq(mcpTools.serverId, c.req.param("id")))
    .orderBy(mcpTools.name);
  return c.json({ data: result });
});

export { mcpRoutes };
