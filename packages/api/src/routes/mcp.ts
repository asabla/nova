import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, isNull } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { mcpServers, mcpTools, mcpServerWhitelist } from "@nova/shared/schemas";
import { requireRole } from "../middleware/rbac";
import { AppError } from "@nova/shared/utils";

const mcpRoutes = new Hono<AppContext>();

// ---------------------------------------------------------------------------
// MCP Servers
// ---------------------------------------------------------------------------

mcpRoutes.get("/servers", async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(mcpServers)
    .where(and(eq(mcpServers.orgId, orgId), isNull(mcpServers.deletedAt)))
    .orderBy(desc(mcpServers.createdAt));
  return c.json({ data: result });
});

mcpRoutes.get("/servers/:id", async (c) => {
  const orgId = c.get("orgId");
  const [server] = await db.select().from(mcpServers)
    .where(and(
      eq(mcpServers.id, c.req.param("id")),
      eq(mcpServers.orgId, orgId),
      isNull(mcpServers.deletedAt),
    ));
  if (!server) throw AppError.notFound("MCP server not found");
  return c.json(server);
});

const addServerSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  description: z.string().max(2000).optional(),
  authType: z.enum(["none", "bearer", "api_key"]).optional(),
});

mcpRoutes.post("/servers", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = addServerSchema.parse(await c.req.json());

  const [server] = await db.insert(mcpServers).values({
    orgId,
    registeredById: userId,
    name: body.name,
    url: body.url,
    description: body.description,
    authType: body.authType ?? "none",
    healthStatus: "pending",
  }).returning();

  return c.json(server, 201);
});

mcpRoutes.patch("/servers/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    name: z.string().optional(),
    url: z.string().url().optional(),
    description: z.string().max(2000).optional(),
    isEnabled: z.boolean().optional(),
    isApproved: z.boolean().optional(),
  }).parse(await c.req.json());

  const [server] = await db.update(mcpServers)
    .set({ ...body, updatedAt: new Date() })
    .where(and(
      eq(mcpServers.id, c.req.param("id")),
      eq(mcpServers.orgId, orgId),
      isNull(mcpServers.deletedAt),
    ))
    .returning();

  if (!server) throw AppError.notFound("MCP server not found");
  return c.json(server);
});

mcpRoutes.delete("/servers/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const serverId = c.req.param("id");

  // Soft-delete associated tools
  await db.update(mcpTools)
    .set({ deletedAt: new Date() })
    .where(eq(mcpTools.mcpServerId, serverId));

  const [server] = await db.update(mcpServers)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(mcpServers.id, serverId),
      eq(mcpServers.orgId, orgId),
      isNull(mcpServers.deletedAt),
    ))
    .returning();

  if (!server) throw AppError.notFound("MCP server not found");
  return c.body(null, 204);
});

// Test MCP server connectivity
mcpRoutes.post("/servers/:id/test", async (c) => {
  const orgId = c.get("orgId");
  const [server] = await db.select().from(mcpServers)
    .where(and(
      eq(mcpServers.id, c.req.param("id")),
      eq(mcpServers.orgId, orgId),
      isNull(mcpServers.deletedAt),
    ));

  if (!server) throw AppError.notFound("MCP server not found");

  const start = Date.now();
  try {
    const resp = await fetch(server.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: {}, id: 1 }),
      signal: AbortSignal.timeout(10_000),
    });

    const latencyMs = Date.now() - start;
    const isOk = resp.ok;
    let serverInfo: unknown = null;

    if (isOk) {
      try {
        const json = await resp.json();
        serverInfo = json.result ?? json;
      } catch {
        // Response was not JSON - still treat as connected
      }
    }

    await db.update(mcpServers)
      .set({
        healthStatus: isOk ? "connected" : "error",
        lastHealthCheckAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.id, server.id));

    return c.json({ connected: isOk, status: resp.status, latencyMs, serverInfo });
  } catch (err) {
    const latencyMs = Date.now() - start;
    await db.update(mcpServers)
      .set({
        healthStatus: "error",
        lastHealthCheckAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.id, server.id));

    return c.json({
      connected: false,
      error: err instanceof Error ? err.message : "Connection failed",
      latencyMs,
    });
  }
});

// List tools for an MCP server (from DB cache)
mcpRoutes.get("/servers/:id/tools", async (c) => {
  const orgId = c.get("orgId");

  // Verify server belongs to org
  const [server] = await db.select().from(mcpServers)
    .where(and(
      eq(mcpServers.id, c.req.param("id")),
      eq(mcpServers.orgId, orgId),
      isNull(mcpServers.deletedAt),
    ));
  if (!server) throw AppError.notFound("MCP server not found");

  // Try to fetch tools from the remote server and sync them
  try {
    const resp = await fetch(server.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", params: {}, id: 2 }),
      signal: AbortSignal.timeout(10_000),
    });

    if (resp.ok) {
      const json = await resp.json();
      const remoteTools: Array<{ name: string; description?: string; inputSchema?: unknown }> =
        json.result?.tools ?? json.tools ?? [];

      if (remoteTools.length > 0) {
        // Upsert tools: delete old, insert fresh
        await db.delete(mcpTools).where(eq(mcpTools.mcpServerId, server.id));
        await db.insert(mcpTools).values(
          remoteTools.map((t) => ({
            mcpServerId: server.id,
            orgId,
            name: t.name,
            description: t.description ?? null,
            inputSchema: t.inputSchema ?? null,
          })),
        );
      }
    }
  } catch {
    // Fall through to return cached tools
  }

  const result = await db.select().from(mcpTools)
    .where(and(
      eq(mcpTools.mcpServerId, c.req.param("id")),
      isNull(mcpTools.deletedAt),
    ))
    .orderBy(mcpTools.name);

  return c.json({ data: result });
});

// ---------------------------------------------------------------------------
// MCP Server URL Whitelist (admin only)
// ---------------------------------------------------------------------------

const addWhitelistSchema = z.object({
  urlPattern: z.string().min(1).max(2000),
  description: z.string().max(2000).optional(),
});

mcpRoutes.post("/whitelist", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = addWhitelistSchema.parse(await c.req.json());

  const [entry] = await db.insert(mcpServerWhitelist).values({
    orgId,
    createdById: userId,
    urlPattern: body.urlPattern,
    description: body.description,
  }).returning();

  return c.json(entry, 201);
});

mcpRoutes.get("/whitelist", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(mcpServerWhitelist)
    .where(and(
      eq(mcpServerWhitelist.orgId, orgId),
      isNull(mcpServerWhitelist.deletedAt),
    ))
    .orderBy(desc(mcpServerWhitelist.createdAt));
  return c.json({ data: result });
});

mcpRoutes.delete("/whitelist/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const [entry] = await db.update(mcpServerWhitelist)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(mcpServerWhitelist.id, c.req.param("id")),
      eq(mcpServerWhitelist.orgId, orgId),
      isNull(mcpServerWhitelist.deletedAt),
    ))
    .returning();

  if (!entry) throw AppError.notFound("Whitelist entry not found");
  return c.body(null, 204);
});

export { mcpRoutes };
