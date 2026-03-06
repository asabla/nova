import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { ssoProviders } from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

const ssoRoutes = new Hono<AppContext>();

// List SSO providers for org
ssoRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");

  const providers = await db
    .select({
      id: ssoProviders.id,
      type: ssoProviders.type,
      providerName: ssoProviders.providerName,
      clientId: ssoProviders.clientId,
      issuerUrl: ssoProviders.issuerUrl,
      metadataUrl: ssoProviders.metadataUrl,
      isEnabled: ssoProviders.isEnabled,
      autoProvisionUsers: ssoProviders.autoProvisionUsers,
      defaultRole: ssoProviders.defaultRole,
      createdAt: ssoProviders.createdAt,
      updatedAt: ssoProviders.updatedAt,
    })
    .from(ssoProviders)
    .where(and(eq(ssoProviders.orgId, orgId), isNull(ssoProviders.deletedAt)))
    .orderBy(desc(ssoProviders.createdAt));

  return c.json({ data: providers });
});

// Get SSO provider
ssoRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const [provider] = await db
    .select({
      id: ssoProviders.id,
      type: ssoProviders.type,
      providerName: ssoProviders.providerName,
      clientId: ssoProviders.clientId,
      issuerUrl: ssoProviders.issuerUrl,
      metadataUrl: ssoProviders.metadataUrl,
      isEnabled: ssoProviders.isEnabled,
      autoProvisionUsers: ssoProviders.autoProvisionUsers,
      defaultRole: ssoProviders.defaultRole,
      createdAt: ssoProviders.createdAt,
    })
    .from(ssoProviders)
    .where(and(eq(ssoProviders.id, c.req.param("id")), eq(ssoProviders.orgId, orgId), isNull(ssoProviders.deletedAt)));

  if (!provider) throw AppError.notFound("SSO Provider");
  return c.json(provider);
});

const createSsoSchema = z.object({
  type: z.enum(["oidc", "saml", "azure-ad", "google", "github", "gitlab"]),
  providerName: z.string().min(1).max(200),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  issuerUrl: z.string().url().optional(),
  metadataUrl: z.string().url().optional(),
  autoProvisionUsers: z.boolean().optional(),
  defaultRole: z.enum(["member", "power-user", "org-admin"]).optional(),
});

ssoRoutes.post("/", zValidator("json", createSsoSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { clientSecret, ...data } = c.req.valid("json");

  // In production, encrypt the client secret with pgcrypto or a KMS
  const clientSecretEncrypted = Buffer.from(clientSecret).toString("base64");

  const [provider] = await db
    .insert(ssoProviders)
    .values({ ...data, orgId, clientSecretEncrypted })
    .returning();

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "sso.provider.create",
    resourceType: "sso_provider",
    resourceId: provider.id,
    details: { type: data.type, providerName: data.providerName },
  });

  return c.json({ id: provider.id, type: provider.type, providerName: provider.providerName }, 201);
});

const updateSsoSchema = z.object({
  providerName: z.string().min(1).max(200).optional(),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  issuerUrl: z.string().url().optional(),
  metadataUrl: z.string().url().optional(),
  isEnabled: z.boolean().optional(),
  autoProvisionUsers: z.boolean().optional(),
  defaultRole: z.enum(["member", "power-user", "org-admin"]).optional(),
});

ssoRoutes.patch("/:id", zValidator("json", updateSsoSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { clientSecret, ...data } = c.req.valid("json");

  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (clientSecret) {
    updateData.clientSecretEncrypted = Buffer.from(clientSecret).toString("base64");
  }

  const [provider] = await db
    .update(ssoProviders)
    .set(updateData)
    .where(and(eq(ssoProviders.id, c.req.param("id")), eq(ssoProviders.orgId, orgId), isNull(ssoProviders.deletedAt)))
    .returning();

  if (!provider) throw AppError.notFound("SSO Provider");

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "sso.provider.update",
    resourceType: "sso_provider",
    resourceId: provider.id,
  });

  return c.json({ id: provider.id, type: provider.type, providerName: provider.providerName });
});

ssoRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const [provider] = await db
    .update(ssoProviders)
    .set({ deletedAt: new Date() })
    .where(and(eq(ssoProviders.id, c.req.param("id")), eq(ssoProviders.orgId, orgId), isNull(ssoProviders.deletedAt)))
    .returning();

  if (!provider) throw AppError.notFound("SSO Provider");

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "sso.provider.delete",
    resourceType: "sso_provider",
    resourceId: provider.id,
  });

  return c.json({ ok: true });
});

// Test SSO connectivity
ssoRoutes.post("/:id/test", async (c) => {
  const orgId = c.get("orgId");
  const [provider] = await db
    .select()
    .from(ssoProviders)
    .where(and(eq(ssoProviders.id, c.req.param("id")), eq(ssoProviders.orgId, orgId), isNull(ssoProviders.deletedAt)));

  if (!provider) throw AppError.notFound("SSO Provider");

  // Test connectivity by fetching OIDC discovery or metadata URL
  try {
    const testUrl = provider.metadataUrl ?? `${provider.issuerUrl}/.well-known/openid-configuration`;
    if (!testUrl) return c.json({ success: false, error: "No discovery URL configured" });

    const response = await fetch(testUrl, { signal: AbortSignal.timeout(10_000) });
    if (response.ok) {
      const data = await response.json();
      return c.json({
        success: true,
        issuer: data.issuer,
        authorizationEndpoint: data.authorization_endpoint,
        tokenEndpoint: data.token_endpoint,
      });
    }
    return c.json({ success: false, error: `HTTP ${response.status}` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message ?? "Connection failed" });
  }
});

export { ssoRoutes };
