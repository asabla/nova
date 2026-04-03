import { Hono } from "hono";
import { z } from "zod";
import { eq, and, sql, isNull } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { orgService } from "../services/org.service";
import { writeAuditLog } from "../services/audit.service";
import { requireRole } from "../middleware/rbac";
import { db } from "../lib/db";
import { orgSettings } from "@nova/shared/schemas";

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
  const settings = await db.select().from(orgSettings).where(eq(orgSettings.orgId, orgId));
  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return c.json(result);
});

orgRoutes.put("/settings", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const body = await c.req.json() as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    await db.insert(orgSettings).values({ orgId, key, value: String(value) })
      .onConflictDoUpdate({
        target: [orgSettings.orgId, orgSettings.key],
        set: { value: String(value), updatedAt: new Date() },
      });
  }
  return c.json({ ok: true });
});

// Bulk settings update
orgRoutes.put("/settings/bulk", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const { settings: settingsMap } = z.object({
    settings: z.record(z.string(), z.string()),
  }).parse(await c.req.json());

  for (const [key, value] of Object.entries(settingsMap)) {
    await db.insert(orgSettings).values({ orgId, key, value: String(value) })
      .onConflictDoUpdate({
        target: [orgSettings.orgId, orgSettings.key],
        set: { value: String(value), updatedAt: new Date() },
      });
  }
  return c.json({ ok: true, count: Object.keys(settingsMap).length });
});

// Security policies
const securityPoliciesSchema = z.object({
  mfaRequired: z.boolean().optional(),
  passwordMinLength: z.number().int().min(6).max(128).optional(),
  passwordRequireUppercase: z.boolean().optional(),
  passwordRequireNumbers: z.boolean().optional(),
  passwordRequireSymbols: z.boolean().optional(),
  passwordExpiryDays: z.number().int().min(1).max(365).nullable().optional(),
  sessionMaxAge: z.number().int().min(1).max(720).optional(),
});

const defaultSecurityPolicies = {
  mfaRequired: false,
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireNumbers: false,
  passwordRequireSymbols: false,
  passwordExpiryDays: null as number | null,
  sessionMaxAge: 24,
};

orgRoutes.get("/security-policies", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const [row] = await db.select().from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, "security_policies")));

  const policies = row ? { ...defaultSecurityPolicies, ...JSON.parse(row.value) } : defaultSecurityPolicies;
  return c.json(policies);
});

orgRoutes.patch("/security-policies", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = securityPoliciesSchema.parse(await c.req.json());

  // Merge with existing
  const [existing] = await db.select().from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, "security_policies")));

  const current = existing ? JSON.parse(existing.value) : {};
  const merged = { ...current, ...body };

  await db.insert(orgSettings).values({
    orgId,
    key: "security_policies",
    value: JSON.stringify(merged),
  }).onConflictDoUpdate({
    target: [orgSettings.orgId, orgSettings.key],
    set: { value: JSON.stringify(merged), updatedAt: new Date() },
  });

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "org.security_policies.update",
    resourceType: "org",
    resourceId: orgId,
    details: body,
  });

  return c.json({ ...defaultSecurityPolicies, ...merged });
});

// MFA enrollment status across the org
orgRoutes.get("/mfa-status", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const members = await orgService.listMembers(orgId);
  const totalMembers = members.length;

  // Query mfa_credentials for each member
  const { mfaCredentials } = await import("@nova/shared/schemas");
  const memberUserIds = members.map((m: any) => m.user.id ?? m.profile.userId);

  let enrolledCount = 0;
  if (memberUserIds.length > 0) {
    const enrolled = await db.select({ userId: mfaCredentials.userId })
      .from(mfaCredentials)
      .where(and(
        sql`${mfaCredentials.userId} = ANY(${memberUserIds})`,
        isNull(mfaCredentials.deletedAt),
      ));
    const enrolledSet = new Set(enrolled.map(e => e.userId));
    enrolledCount = enrolledSet.size;
  }

  return c.json({
    totalMembers,
    mfaEnrolled: enrolledCount,
    mfaNotEnrolled: totalMembers - enrolledCount,
    enrollmentPct: totalMembers > 0 ? Math.round((enrolledCount / totalMembers) * 100) : 0,
  });
});

// Billing - Get current billing status
orgRoutes.get("/billing", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const { billingService } = await import("../services/billing.service");
  const status = await billingService.getBillingStatus(orgId);
  return c.json(status);
});

// Billing - Change plan (Stripe checkout or direct for self-hosted)
orgRoutes.post("/billing/change-plan", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { plan } = z.object({ plan: z.enum(["free", "team", "enterprise"]) }).parse(await c.req.json());
  const { billingService } = await import("../services/billing.service");

  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const result = await billingService.createCheckoutSession(
    orgId,
    plan,
    `${appUrl}/admin/billing?success=true`,
    `${appUrl}/admin/billing?canceled=true`,
  );

  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "org.billing.change_plan", resourceType: "org", resourceId: orgId, details: { plan } });
  return c.json(result);
});

// Billing - Create portal session for managing subscription
orgRoutes.post("/billing/portal", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const { billingService } = await import("../services/billing.service");
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const result = await billingService.createBillingPortalSession(orgId, `${appUrl}/admin/billing`);
  return c.json(result);
});

// Billing - Get current payment method
orgRoutes.get("/billing/payment-method", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const { billingService } = await import("../services/billing.service");
  const paymentMethod = await billingService.getPaymentMethod(orgId);
  return c.json({ data: paymentMethod });
});

// Billing - Get invoice history
orgRoutes.get("/billing/invoices", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const { billingService } = await import("../services/billing.service");
  const invoices = await billingService.getInvoices(orgId);
  return c.json({ data: invoices });
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
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "org.member.role_change", resourceType: "user", resourceId: c.req.param("userId"), details: { role } });
  return c.json(member);
});

orgRoutes.delete("/members/:userId", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  await orgService.removeMember(orgId, c.req.param("userId"));
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "org.member.remove", resourceType: "user", resourceId: c.req.param("userId") });
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
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "org.invitation.create", resourceType: "invitation", resourceId: invitation.id });
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

// Setup wizard status (Story #203) - check if initial setup is complete
orgRoutes.get("/setup-status", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");

  const org = await orgService.get(orgId);
  const members = await orgService.listMembers(orgId);
  const settings = await db.select().from(orgSettings).where(eq(orgSettings.orgId, orgId));
  const settingsMap: Record<string, string> = {};
  for (const s of settings) settingsMap[s.key] = s.value;

  // Check LiteLLM connectivity
  let litellmConnected = false;
  try {
    const litellmUrl = settingsMap["litellm_url"] || process.env.LITELLM_API_URL || "http://localhost:4000";
    const res = await fetch(`${litellmUrl}/health`, { signal: AbortSignal.timeout(3000) });
    litellmConnected = res.ok;
  } catch { /* not connected */ }

  const steps = {
    orgName: { done: !!org.name && org.name !== "Default Organization", label: "Set organization name" },
    modelProvider: { done: litellmConnected || !!settingsMap["litellm_url"], label: "Configure model provider (LiteLLM)" },
    firstUser: { done: members.length >= 1, label: "Create first user" },
    branding: { done: !!org.logoUrl || !!settingsMap["branding.logo_url"], label: "Add branding (optional)" },
    inviteMembers: { done: members.length >= 2, label: "Invite team members (optional)" },
  };

  const requiredSteps = ["orgName", "modelProvider", "firstUser"] as const;
  const isComplete = requiredSteps.every((key) => steps[key].done);

  return c.json({
    isComplete,
    completedCount: Object.values(steps).filter((s) => s.done).length,
    totalSteps: Object.keys(steps).length,
    steps,
  });
});

// Complete setup wizard
orgRoutes.post("/setup-complete", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const body = z.object({
    orgName: z.string().min(1).max(200).optional(),
    litellmUrl: z.string().url().optional(),
    defaultModel: z.string().optional(),
  }).parse(await c.req.json());

  if (body.orgName) {
    await orgService.update(orgId, { name: body.orgName });
  }

  if (body.litellmUrl) {
    await db.insert(orgSettings).values({ orgId, key: "litellm_url", value: body.litellmUrl })
      .onConflictDoUpdate({ target: [orgSettings.orgId, orgSettings.key], set: { value: body.litellmUrl, updatedAt: new Date() } });
  }

  if (body.defaultModel) {
    await db.insert(orgSettings).values({ orgId, key: "default_model", value: body.defaultModel })
      .onConflictDoUpdate({ target: [orgSettings.orgId, orgSettings.key], set: { value: body.defaultModel, updatedAt: new Date() } });
  }

  // Mark setup as complete
  await db.insert(orgSettings).values({ orgId, key: "setup_complete", value: "true" })
    .onConflictDoUpdate({ target: [orgSettings.orgId, orgSettings.key], set: { value: "true", updatedAt: new Date() } });

  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "org.setup.complete", resourceType: "org", resourceId: orgId });

  return c.json({ ok: true });
});

export { orgRoutes };
