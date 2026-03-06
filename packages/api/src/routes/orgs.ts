import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { orgService } from "../services/org.service";
import { auditService } from "../services/audit.service";
import { requireRole } from "../middleware/rbac";

const orgRoutes = new Hono<AppContext>();

orgRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const org = await orgService.get(orgId);
  return c.json(org);
});

orgRoutes.patch("/", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    name: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(100).optional(),
    logoUrl: z.string().url().optional(),
  }).parse(await c.req.json());

  const org = await orgService.update(orgId, body);
  return c.json(org);
});

orgRoutes.get("/settings", async (c) => {
  const orgId = c.get("orgId");
  const settings = await orgService.getSettings(orgId);
  return c.json(settings);
});

orgRoutes.put("/settings", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = await c.req.json();
  const settings = await orgService.updateSettings(orgId, body);
  return c.json(settings);
});

// Members
orgRoutes.get("/members", async (c) => {
  const orgId = c.get("orgId");
  const members = await orgService.listMembers(orgId);
  return c.json({ data: members });
});

orgRoutes.patch("/members/:userId/role", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { role } = z.object({ role: z.string() }).parse(await c.req.json());
  const member = await orgService.updateMemberRole(orgId, c.req.param("userId"), role);
  await auditService.writeAuditLog({ orgId, userId, action: "org.member.role_change", resourceType: "user", resourceId: c.req.param("userId"), metadata: { role } });
  return c.json(member);
});

orgRoutes.delete("/members/:userId", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  await orgService.removeMember(orgId, c.req.param("userId"));
  await auditService.writeAuditLog({ orgId, userId, action: "org.member.remove", resourceType: "user", resourceId: c.req.param("userId") });
  return c.body(null, 204);
});

// Invitations
orgRoutes.get("/invitations", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const invitations = await orgService.listInvitations(orgId);
  return c.json({ data: invitations });
});

orgRoutes.post("/invitations", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = z.object({
    email: z.string().email(),
    role: z.string().optional(),
  }).parse(await c.req.json());

  const invitation = await orgService.createInvitation(orgId, userId, body);
  await auditService.writeAuditLog({ orgId, userId, action: "org.invitation.create", resourceType: "invitation", resourceId: invitation.id });
  return c.json(invitation, 201);
});

orgRoutes.delete("/invitations/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  await orgService.revokeInvitation(orgId, c.req.param("id"));
  return c.body(null, 204);
});

// Groups
orgRoutes.get("/groups", async (c) => {
  const orgId = c.get("orgId");
  const groups = await orgService.listGroups(orgId);
  return c.json({ data: groups });
});

orgRoutes.post("/groups", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  }).parse(await c.req.json());
  const group = await orgService.createGroup(orgId, body);
  return c.json(group, 201);
});

orgRoutes.delete("/groups/:id", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  await orgService.deleteGroup(orgId, c.req.param("id"));
  return c.body(null, 204);
});

export { orgRoutes };
