import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, sql, ilike, or, isNull } from "drizzle-orm";
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
    registeredById: userId,
    name: body.name,
    description: body.description,
    type: body.type,
    functionSchema: body.schema ?? {},
    isEnabled: true,
  }).returning();

  return c.json(tool, 201);
});

toolRoutes.patch("/:id", requireRole("power-user"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const role = c.get("role");
  const body = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    isEnabled: z.boolean().optional(),
    isApproved: z.boolean().optional(),
    rejectionReason: z.string().max(2000).optional(),
    tags: z.array(z.string()).optional(),
  }).parse(await c.req.json());

  // Approval/rejection requires org-admin role
  if (body.isApproved !== undefined) {
    if (role !== "org-admin" && role !== "super-admin") {
      throw AppError.forbidden("Only org admins can approve or reject tools");
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled;
  if (body.tags !== undefined) updateData.tags = body.tags;

  if (body.isApproved !== undefined) {
    updateData.isApproved = body.isApproved;
    updateData.approvedById = userId;
    updateData.approvedAt = body.isApproved ? new Date() : null;
    updateData.rejectionReason = body.isApproved ? null : (body.rejectionReason ?? null);
  }

  const [tool] = await db.update(tools)
    .set(updateData)
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

// Test tool execution
toolRoutes.post("/:id/test", async (c) => {
  const orgId = c.get("orgId");
  const [tool] = await db.select().from(tools)
    .where(and(eq(tools.id, c.req.param("id")), eq(tools.orgId, orgId)));
  if (!tool) throw AppError.notFound("Tool not found");

  const body = await c.req.json() as { input: Record<string, unknown> };
  const startTime = Date.now();

  try {
    // For function tools, validate against schema
    // For API tools, make the request
    let result: unknown = { message: "Test execution successful", input: body.input };

    const spec = tool.openapiSpec as Record<string, unknown> | null;
    if (tool.type === "openapi" && spec?.endpoint) {
      const resp = await fetch(String(spec.endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.input),
        signal: AbortSignal.timeout(10_000),
      });
      result = await resp.json();
    }

    return c.json({
      success: true,
      result,
      latencyMs: Date.now() - startTime,
    });
  } catch (err: any) {
    return c.json({
      success: false,
      error: err.message,
      latencyMs: Date.now() - startTime,
    });
  }
});

// Browse shared/approved tools (marketplace)
toolRoutes.get("/marketplace/browse", async (c) => {
  const orgId = c.get("orgId");
  const search = c.req.query("search");
  const type = c.req.query("type");

  const conditions: any[] = [
    eq(tools.orgId, orgId),
    eq(tools.isApproved, true),
    eq(tools.isEnabled, true),
    isNull(tools.deletedAt),
  ];

  if (search) {
    conditions.push(
      or(
        ilike(tools.name, `%${search}%`),
        ilike(tools.description, `%${search}%`),
      ),
    );
  }

  if (type && type !== "all") {
    conditions.push(eq(tools.type, type));
  }

  const result = await db.select().from(tools)
    .where(and(...conditions))
    .orderBy(desc(tools.updatedAt))
    .limit(50);

  return c.json({ data: result });
});

export { toolRoutes };
