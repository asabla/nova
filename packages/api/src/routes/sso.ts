import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { logger } from "../lib/logger";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { ssoProviders, ssoSessions, groups, groupMemberships } from "@nova/shared/schemas";
import { users, userProfiles, sessions, organisations, orgSettings } from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

// ─── Provider Configuration ──────────────────────────────────

interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  /** Map provider user-info JSON to a normalized profile */
  mapProfile: (data: Record<string, unknown>) => {
    externalId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

type SupportedProvider = "azure-ad" | "google" | "github";

function getProviderConfig(provider: SupportedProvider): OAuthProviderConfig | null {
  switch (provider) {
    case "azure-ad": {
      if (!env.AZURE_AD_CLIENT_ID || !env.AZURE_AD_CLIENT_SECRET || !env.AZURE_AD_TENANT_ID) return null;
      const tenantId = env.AZURE_AD_TENANT_ID;
      return {
        clientId: env.AZURE_AD_CLIENT_ID,
        clientSecret: env.AZURE_AD_CLIENT_SECRET,
        authorizeUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        userInfoUrl: "https://graph.microsoft.com/v1.0/me",
        scopes: ["openid", "profile", "email", "User.Read", "GroupMember.Read.All"],
        mapProfile: (data) => ({
          externalId: (data.id ?? data.sub) as string,
          email: (data.mail ?? data.userPrincipalName) as string,
          name: (data.displayName as string) ?? null,
          avatarUrl: null,
        }),
      };
    }
    case "google": {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
      return {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
        scopes: ["openid", "profile", "email"],
        mapProfile: (data) => ({
          externalId: data.sub as string,
          email: data.email as string,
          name: (data.name as string) ?? null,
          avatarUrl: (data.picture as string) ?? null,
        }),
      };
    }
    case "github": {
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return null;
      return {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        authorizeUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userInfoUrl: "https://api.github.com/user",
        scopes: ["read:user", "user:email"],
        mapProfile: (data) => ({
          externalId: String(data.id),
          email: (data.email as string) ?? "",
          name: (data.name as string) ?? (data.login as string) ?? null,
          avatarUrl: (data.avatar_url as string) ?? null,
        }),
      };
    }
    default:
      return null;
  }
}

/**
 * Sync Azure AD group memberships for a user after SSO login.
 * Fetches the user's group memberships from Microsoft Graph and maps them
 * to Nova groups via the ssoGroupId field.
 */
async function syncAzureADGroups(accessToken: string, userId: string, orgId: string): Promise<void> {
  // Fetch user's group memberships from Microsoft Graph
  const res = await fetch("https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName,@odata.type", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    logger.warn({ status: res.status }, "Failed to fetch Azure AD group memberships");
    return;
  }

  const data = (await res.json()) as { value: Array<{ "@odata.type": string; id: string; displayName: string }> };
  const adGroups = (data.value ?? []).filter((v) => v["@odata.type"] === "#microsoft.graph.group");

  if (adGroups.length === 0) return;

  const adGroupIds = adGroups.map((g) => g.id);

  // Find Nova groups in this org that have a matching ssoGroupId
  const novaGroups = await db
    .select({ id: groups.id, ssoGroupId: groups.ssoGroupId })
    .from(groups)
    .where(and(eq(groups.orgId, orgId), isNull(groups.deletedAt)));

  const mappedGroups = novaGroups.filter((g) => g.ssoGroupId && adGroupIds.includes(g.ssoGroupId));

  if (mappedGroups.length === 0) return;

  // Get current Nova group memberships for this user
  const currentMemberships = await db
    .select({ groupId: groupMemberships.groupId })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.userId, userId), eq(groupMemberships.orgId, orgId), isNull(groupMemberships.deletedAt)));

  const currentGroupIds = new Set(currentMemberships.map((m) => m.groupId));
  const targetGroupIds = new Set(mappedGroups.map((g) => g.id));

  // Add missing memberships
  for (const groupId of targetGroupIds) {
    if (!currentGroupIds.has(groupId)) {
      await db.insert(groupMemberships).values({ groupId, userId, orgId }).onConflictDoNothing();
    }
  }

  // Remove memberships for SSO-mapped groups the user is no longer in
  const ssoMappedGroupIds = new Set(novaGroups.filter((g) => g.ssoGroupId).map((g) => g.id));
  for (const groupId of currentGroupIds) {
    if (ssoMappedGroupIds.has(groupId) && !targetGroupIds.has(groupId)) {
      await db.update(groupMemberships).set({ deletedAt: new Date() })
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId), eq(groupMemberships.orgId, orgId), isNull(groupMemberships.deletedAt)));
    }
  }

  logger.info({ userId, orgId, synced: mappedGroups.length }, "Azure AD group sync completed");
}

// In-memory state store for CSRF protection (use Redis in production)
const oauthStateStore = new Map<string, { provider: SupportedProvider; orgSlug: string | null; createdAt: number }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStateStore) {
    if (now - val.createdAt > 10 * 60 * 1000) oauthStateStore.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Public SSO OAuth Routes (no auth required) ─────────────

const ssoOAuthRoutes = new Hono();

const SUPPORTED_PROVIDERS = ["azure-ad", "google", "github"] as const;

const providerParamSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
});

// GET /api/sso/oauth/:provider/authorize
// Redirects the user to the provider's authorization page.
// Optional query param: ?org=<slug> to scope to an org (for org-level SSO config).
ssoOAuthRoutes.get("/:provider/authorize", async (c) => {
  const provider = c.req.param("provider") as SupportedProvider;
  const parseResult = providerParamSchema.safeParse({ provider });
  if (!parseResult.success) {
    return c.json({ error: "Unsupported SSO provider" }, 400);
  }

  const orgSlug = c.req.query("org") ?? null;

  // Check for org-level SSO provider config first, fall back to global env vars
  let config: OAuthProviderConfig | null = null;

  if (orgSlug) {
    // Look up the org and its SSO provider config
    const [org] = await db
      .select({ id: organisations.id })
      .from(organisations)
      .where(and(eq(organisations.slug, orgSlug), isNull(organisations.deletedAt)));

    if (org) {
      const [ssoProvider] = await db
        .select()
        .from(ssoProviders)
        .where(
          and(
            eq(ssoProviders.orgId, org.id),
            eq(ssoProviders.type, provider),
            eq(ssoProviders.isEnabled, true),
            isNull(ssoProviders.deletedAt),
          ),
        );

      if (ssoProvider) {
        // Build config from org-level provider
        const globalCfg = getProviderConfig(provider);
        if (globalCfg) {
          const secret = Buffer.from(ssoProvider.clientSecretEncrypted, "base64").toString("utf-8");
          config = {
            ...globalCfg,
            clientId: ssoProvider.clientId,
            clientSecret: secret,
            // Override issuer-based URLs for Azure AD if the org has a custom issuerUrl
            ...(provider === "azure-ad" && ssoProvider.issuerUrl
              ? {
                  authorizeUrl: `${ssoProvider.issuerUrl}/oauth2/v2.0/authorize`,
                  tokenUrl: `${ssoProvider.issuerUrl}/oauth2/v2.0/token`,
                }
              : {}),
          };
        }
      }
    }
  }

  // Fall back to global env-based config
  if (!config) {
    config = getProviderConfig(provider);
  }

  if (!config) {
    return c.json({ error: `SSO provider '${provider}' is not configured` }, 400);
  }

  // Generate CSRF state token
  const state = randomBytes(32).toString("hex");
  oauthStateStore.set(state, { provider, orgSlug, createdAt: Date.now() });

  const redirectUri = `${env.BETTER_AUTH_URL}/api/sso/oauth/${provider}/callback`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
  });

  // Azure AD and Google support PKCE / prompt parameters
  if (provider === "azure-ad") {
    params.set("response_mode", "query");
  }

  return c.redirect(`${config.authorizeUrl}?${params.toString()}`);
});

// GET /api/sso/oauth/:provider/callback
// Handles the OAuth callback: exchanges code for tokens, fetches user info,
// creates or updates the user, creates a session, and redirects to the app.
ssoOAuthRoutes.get("/:provider/callback", async (c) => {
  const provider = c.req.param("provider") as SupportedProvider;
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const errorDescription = c.req.query("error_description");

  // Handle provider-side errors
  if (error) {
    const msg = errorDescription ?? error;
    return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent(msg)}`);
  }

  if (!code || !state) {
    return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("Missing code or state parameter")}`);
  }

  // Validate CSRF state
  const storedState = oauthStateStore.get(state);
  if (!storedState || storedState.provider !== provider) {
    return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("Invalid or expired state")}`);
  }
  oauthStateStore.delete(state);

  // Check for expiry (10 min window)
  if (Date.now() - storedState.createdAt > 10 * 60 * 1000) {
    return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("SSO request expired, please try again")}`);
  }

  // Resolve provider config (same logic as authorize)
  let config: OAuthProviderConfig | null = null;
  let ssoProviderRow: typeof ssoProviders.$inferSelect | null = null;

  if (storedState.orgSlug) {
    const [org] = await db
      .select({ id: organisations.id })
      .from(organisations)
      .where(and(eq(organisations.slug, storedState.orgSlug), isNull(organisations.deletedAt)));

    if (org) {
      const [row] = await db
        .select()
        .from(ssoProviders)
        .where(
          and(
            eq(ssoProviders.orgId, org.id),
            eq(ssoProviders.type, provider),
            eq(ssoProviders.isEnabled, true),
            isNull(ssoProviders.deletedAt),
          ),
        );

      if (row) {
        ssoProviderRow = row;
        const globalCfg = getProviderConfig(provider);
        if (globalCfg) {
          const secret = Buffer.from(row.clientSecretEncrypted, "base64").toString("utf-8");
          config = {
            ...globalCfg,
            clientId: row.clientId,
            clientSecret: secret,
            ...(provider === "azure-ad" && row.issuerUrl
              ? {
                  authorizeUrl: `${row.issuerUrl}/oauth2/v2.0/authorize`,
                  tokenUrl: `${row.issuerUrl}/oauth2/v2.0/token`,
                }
              : {}),
          };
        }
      }
    }
  }

  if (!config) {
    config = getProviderConfig(provider);
  }

  if (!config) {
    return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("SSO provider not configured")}`);
  }

  const redirectUri = `${env.BETTER_AUTH_URL}/api/sso/oauth/${provider}/callback`;

  try {
    // ── Step 1: Exchange authorization code for tokens ──
    const tokenBody: Record<string, string> = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    };

    const tokenHeaders: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // GitHub returns JSON by default; request JSON explicitly
    if (provider === "github") {
      tokenHeaders["Accept"] = "application/json";
    }

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: tokenHeaders,
      body: new URLSearchParams(tokenBody).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logger.error({ provider, errText }, "SSO token exchange failed");
      return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("Failed to authenticate with provider")}`);
    }

    const tokenData = (await tokenRes.json()) as Record<string, unknown>;
    const accessToken = tokenData.access_token as string;

    if (!accessToken) {
      return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("No access token received from provider")}`);
    }

    // ── Step 2: Fetch user profile from provider ──
    const userInfoRes = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!userInfoRes.ok) {
      return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("Failed to fetch user info from provider")}`);
    }

    let profileData = (await userInfoRes.json()) as Record<string, unknown>;

    // GitHub may not return email in the profile; fetch from /user/emails
    if (provider === "github" && !profileData.email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (emailsRes.ok) {
        const emailList = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primaryEmail = emailList.find((e) => e.primary && e.verified) ?? emailList.find((e) => e.verified);
        if (primaryEmail) {
          profileData = { ...profileData, email: primaryEmail.email };
        }
      }
    }

    const profile = config.mapProfile(profileData);
    if (!profile.email) {
      return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("No email address returned from provider")}`);
    }

    // ── Step 3: Find or create user ──
    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, profile.email.toLowerCase()), isNull(users.deletedAt)));

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update last login
      await db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      // Check if auto-provisioning is allowed
      if (ssoProviderRow && !ssoProviderRow.autoProvisionUsers) {
        return c.redirect(
          `${env.APP_URL}/login?error=${encodeURIComponent("Account does not exist. Contact your administrator.")}`,
        );
      }

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: profile.email.toLowerCase(),
          emailVerifiedAt: new Date(), // Verified via SSO
          lastLoginAt: new Date(),
        })
        .returning();

      userId = newUser.id;

      // If org-scoped, create user profile in the org
      if (ssoProviderRow) {
        await db.insert(userProfiles).values({
          userId,
          orgId: ssoProviderRow.orgId,
          displayName: profile.name,
          avatarUrl: profile.avatarUrl,
          role: ssoProviderRow.defaultRole ?? "member",
        });
      }
    }

    // ── Step 4: Create session ──
    const sessionToken = randomBytes(48).toString("hex");
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        tokenHash,
        ipAddress: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? null,
        userAgent: c.req.header("user-agent") ?? null,
        expiresAt,
      })
      .returning();

    // ── Step 5: Record SSO session link ──
    if (ssoProviderRow) {
      await db.insert(ssoSessions).values({
        sessionId: session.id,
        ssoProviderId: ssoProviderRow.id,
        externalUserId: profile.externalId,
        accessTokenEncrypted: Buffer.from(accessToken).toString("base64"),
        refreshTokenEncrypted: tokenData.refresh_token
          ? Buffer.from(tokenData.refresh_token as string).toString("base64")
          : null,
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + (tokenData.expires_in as number) * 1000)
          : null,
      });
    }

    // ── Step 5.5: Sync Azure AD group memberships ──
    if (provider === "azure-ad" && ssoProviderRow && accessToken) {
      try {
        await syncAzureADGroups(accessToken, userId, ssoProviderRow.orgId);
      } catch (err) {
        logger.warn({ err, userId, provider }, "Azure AD group sync failed (non-blocking)");
      }
    }

    // ── Step 6: Audit log ──
    await writeAuditLog({
      actorId: userId,
      actorType: "user",
      action: `sso.login.${provider}`,
      resourceType: "session",
      resourceId: session.id,
      orgId: ssoProviderRow?.orgId,
      ipAddress: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
      details: { provider, externalId: profile.externalId },
    });

    // ── Step 7: Set session cookie and redirect to app ──
    const isProduction = env.NODE_ENV === "production";
    const cookieValue = `nova_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}${isProduction ? "; Secure" : ""}`;
    c.header("Set-Cookie", cookieValue);

    return c.redirect(`${env.APP_URL}/`);
  } catch (err: any) {
    logger.error({ err, provider }, "SSO callback error");
    return c.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("SSO authentication failed")}`);
  }
});

// GET /api/sso/oauth/providers
// Public endpoint: returns which global SSO providers are available (for login page UI).
ssoOAuthRoutes.get("/providers", async (c) => {
  const available: Array<{ provider: SupportedProvider; name: string }> = [];

  if (env.AZURE_AD_CLIENT_ID && env.AZURE_AD_CLIENT_SECRET && env.AZURE_AD_TENANT_ID) {
    available.push({ provider: "azure-ad", name: "Microsoft (Azure AD)" });
  }
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    available.push({ provider: "google", name: "Google" });
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    available.push({ provider: "github", name: "GitHub" });
  }

  // Also check for org-specific providers if ?org=<slug> is provided
  const orgSlug = c.req.query("org");
  const orgProviders: Array<{ provider: string; name: string }> = [];

  if (orgSlug) {
    const [org] = await db
      .select({ id: organisations.id })
      .from(organisations)
      .where(and(eq(organisations.slug, orgSlug), isNull(organisations.deletedAt)));

    if (org) {
      const providers = await db
        .select({
          type: ssoProviders.type,
          providerName: ssoProviders.providerName,
        })
        .from(ssoProviders)
        .where(
          and(eq(ssoProviders.orgId, org.id), eq(ssoProviders.isEnabled, true), isNull(ssoProviders.deletedAt)),
        );

      for (const p of providers) {
        orgProviders.push({ provider: p.type, name: p.providerName });
      }
    }
  }

  return c.json({ global: available, org: orgProviders });
});

// GET /api/sso/oauth/branding
// Public endpoint: returns custom login page branding for an org (Story #208).
// Query params: ?org=<slug> or ?domain=<domain>
ssoOAuthRoutes.get("/branding", async (c) => {
  const orgSlug = c.req.query("org");
  const domain = c.req.query("domain");

  if (!orgSlug && !domain) {
    return c.json({
      orgName: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: null,
      customCss: null,
      welcomeMessage: null,
    });
  }

  // Resolve org by slug or domain
  const condition = orgSlug
    ? and(eq(organisations.slug, orgSlug), isNull(organisations.deletedAt))
    : and(eq(organisations.domain, domain!), isNull(organisations.deletedAt));

  const [org] = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      logoUrl: organisations.logoUrl,
      faviconUrl: organisations.faviconUrl,
      primaryColor: organisations.primaryColor,
      customCss: organisations.customCss,
    })
    .from(organisations)
    .where(condition);

  if (!org) {
    return c.json({
      orgName: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: null,
      customCss: null,
      welcomeMessage: null,
    });
  }

  // Fetch optional branding settings from org_settings
  const brandingSettings = await db
    .select({ key: orgSettings.key, value: orgSettings.value })
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, org.id), eq(orgSettings.key, "login_branding")));

  let welcomeMessage: string | null = null;
  let extraBranding: Record<string, unknown> = {};

  if (brandingSettings.length > 0) {
    try {
      const parsed = JSON.parse(brandingSettings[0].value);
      welcomeMessage = parsed.welcomeMessage ?? null;
      extraBranding = parsed;
    } catch {
      // ignore malformed JSON
    }
  }

  return c.json({
    orgName: org.name,
    orgSlug: org.slug,
    logoUrl: org.logoUrl,
    faviconUrl: org.faviconUrl,
    primaryColor: org.primaryColor,
    customCss: org.customCss,
    welcomeMessage,
    ...extraBranding,
  });
});

// ─── Authenticated SSO Admin Routes ─────────────────────────

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

export { ssoRoutes, ssoOAuthRoutes };
