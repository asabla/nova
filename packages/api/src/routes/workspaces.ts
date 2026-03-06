import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { workspaceService } from "../services/workspace.service";
import { writeAuditLog } from "../services/audit.service";
import { parsePagination } from "@nova/shared/utils";

const workspaceRoutes = new Hono<AppContext>();

workspaceRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { limit, offset } = parsePagination(c.req.query());
  const result = await workspaceService.list(orgId, userId, { limit, offset });
  return c.json(result);
});

workspaceRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const workspace = await workspaceService.get(orgId, c.req.param("id"));
  return c.json(workspace);
});

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

workspaceRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = createWorkspaceSchema.parse(await c.req.json());
  const workspace = await workspaceService.create(orgId, userId, body);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "workspace.create", resourceType: "workspace", resourceId: workspace.id });
  return c.json(workspace, 201);
});

workspaceRoutes.patch("/:id", async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  }).parse(await c.req.json());
  const workspace = await workspaceService.update(orgId, c.req.param("id"), body);
  return c.json(workspace);
});

workspaceRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  await workspaceService.delete(orgId, c.req.param("id"));
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "workspace.delete", resourceType: "workspace", resourceId: c.req.param("id") });
  return c.body(null, 204);
});

workspaceRoutes.post("/:id/archive", async (c) => {
  const orgId = c.get("orgId");
  await workspaceService.archive(orgId, c.req.param("id"));
  return c.json({ ok: true });
});

// Members
workspaceRoutes.get("/:id/members", async (c) => {
  const members = await workspaceService.listMembers(c.req.param("id"));
  return c.json({ data: members });
});

workspaceRoutes.post("/:id/members", async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    userId: z.string().uuid(),
    role: z.string().optional(),
  }).parse(await c.req.json());
  const membership = await workspaceService.addMember(orgId, c.req.param("id"), body.userId, body.role);
  return c.json(membership, 201);
});

workspaceRoutes.delete("/:id/members/:userId", async (c) => {
  await workspaceService.removeMember(c.req.param("id"), c.req.param("userId"));
  return c.body(null, 204);
});

export { workspaceRoutes };
