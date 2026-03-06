import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { tools, toolVersions, toolCalls } from "@nova/shared/schemas";
import { requireRole } from "../middleware/rbac";
import { parsePagination } from "@nova/shared/utils";
import { AppError } from "@nova/shared/utils";

const toolRoutes = new Hono<AppContext>();

toolRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const { limit, offset } = parsePagination(c.req.query());

  const result = await db.select().from(tools)
    .where(and(eq(tools.orgId, orgId), eq(tools.isEnabled, true)))
    .orderBy(desc(tools.updatedAt))
    .limit(limit)
    .offset(offset);

  return c.json({ data: result });
});

toolRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const [tool] = await db.select().from(tools)
    .where(and(eq(tools.id, c.req.param("id")), eq(tools.orgId, orgId)));
  if (!tool) throw AppError.notFound("Tool not found");
  return c.json(tool);
});

const createToolSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["function", "openapi", "mcp"]),
  schema: z.record(z.unknown()).optional(),
  endpoint: z.string().url().optional(),
});

toolRoutes.post("/", requireRole("power-user"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = createToolSchema.parse(await c.req.json());

  const [tool] = await db.insert(tools).values({
    orgId,
    createdBy: userId,
    name: body.name,
    description: body.description,
    type: body.type,
    schema: body.schema,
    endpoint: body.endpoint,
    isEnabled: true,
  }).returning();

  return c.json(tool, 201);
});

toolRoutes.patch("/:id", requireRole("power-user"), async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    isEnabled: z.boolean().optional(),
    isApproved: z.boolean().optional(),
  }).parse(await c.req.json());

  const [tool] = await db.update(tools)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(tools.id, c.req.param("id")), eq(tools.orgId, orgId)))
    .returning();

  if (!tool) throw AppError.notFound("Tool not found");
  return c.json(tool);
});

toolRoutes.delete("/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  await db.delete(tools)
    .where(and(eq(tools.id, c.req.param("id")), eq(tools.orgId, orgId)));
  return c.body(null, 204);
});

// Tool call history
toolRoutes.get("/:id/calls", async (c) => {
  const { limit, offset } = parsePagination(c.req.query());
  const result = await db.select().from(toolCalls)
    .where(eq(toolCalls.toolId, c.req.param("id")))
    .orderBy(desc(toolCalls.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ data: result });
});

export { toolRoutes };
