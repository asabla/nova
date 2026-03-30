import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { auth } from "../lib/auth";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { mfaCredentials, users, magicLinkTokens, userProfiles, organisations } from "@nova/shared/schemas";
import { orgSettings } from "@nova/shared/schemas";
import { eq, and, isNull, gt } from "drizzle-orm";
import { AppError } from "@nova/shared/utils";
import { requireRole } from "../middleware/rbac";
import { randomBytes, createHash } from "crypto";
import * as OTPAuth from "otpauth";
import { sendEmail, buildMagicLinkEmail } from "../lib/email";
import { env } from "../lib/env";

const authRoutes = new Hono<AppContext>();

// ─── Magic Link ───────────────────────────────────────────

const magicLinkSchema = z.object({
  email: z.string().email(),
});

authRoutes.post("/magic-link", zValidator("json", magicLinkSchema), async (c) => {
  const { email } = c.req.valid("json");

  // Check if user exists
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)));

  if (user.length === 0) {
    // Return success anyway to avoid email enumeration
    return c.json({ ok: true, message: "If the email exists, a magic link has been sent." });
  }

  // Generate a magic link token
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Store the token hash in the database
  await db.insert(magicLinkTokens).values({
    userId: user[0].id,
    tokenHash,
    expiresAt,
  });

  // Build the magic link URL
  const appUrl = env.APP_URL ?? "http://localhost:5173";
  const magicLinkUrl = `${appUrl}/login/magic-link?token=${token}`;

  // Send the email
  const emailContent = buildMagicLinkEmail(magicLinkUrl);
  await sendEmail({
    to: email,
    ...emailContent,
  });

  return c.json({
    ok: true,
    message: "If the email exists, a magic link has been sent.",
  });
});

// POST /magic-link/verify - Verify magic link token and create session
const magicLinkVerifySchema = z.object({
  token: z.string().min(1),
});

authRoutes.post("/magic-link/verify", zValidator("json", magicLinkVerifySchema), async (c) => {
  const { token } = c.req.valid("json");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Look up the token in the database
  const tokenRecords = await db
    .select()
    .from(magicLinkTokens)
    .where(
      and(
        eq(magicLinkTokens.tokenHash, tokenHash),
        isNull(magicLinkTokens.usedAt),
        gt(magicLinkTokens.expiresAt, new Date()),
      ),
    );

  if (tokenRecords.length === 0) {
    throw AppError.unauthorized("Invalid or expired magic link token");
  }

  const tokenRecord = tokenRecords[0];

  // Mark the token as used
  await db
    .update(magicLinkTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokens.id, tokenRecord.id));

  // Fetch the user
  const userRecords = await db
    .select()
    .from(users)
    .where(and(eq(users.id, tokenRecord.userId), isNull(users.deletedAt)));

  if (userRecords.length === 0) {
    throw AppError.unauthorized("User not found");
  }

  const user = userRecords[0];

  // Update last login timestamp
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), emailVerifiedAt: user.emailVerifiedAt ?? new Date() })
    .where(eq(users.id, user.id));

  return c.json({
    ok: true,
    userId: user.id,
    email: user.email,
  });
});

// ─── TOTP (Time-based One-Time Password) ──────────────────

// POST /totp/setup - Generate TOTP secret + QR code URI
authRoutes.post("/totp/setup", async (c) => {
  const userId = c.get("userId");

  // Check if TOTP is already set up
  const existing = await db
    .select()
    .from(mfaCredentials)
    .where(and(eq(mfaCredentials.userId, userId), eq(mfaCredentials.type, "totp"), isNull(mfaCredentials.deletedAt)));

  if (existing.length > 0) {
    throw AppError.conflict("TOTP is already configured. Disable it first to set up a new one.");
  }

  // Get user email for the TOTP label
  const userRecords = await db.select().from(users).where(eq(users.id, userId));
  const userEmail = userRecords[0]?.email ?? "user";

  // Generate TOTP secret using otpauth library
  const totp = new OTPAuth.TOTP({
    issuer: "NOVA",
    label: userEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const otpauthUri = totp.toString();

  // Store the secret
  await db.insert(mfaCredentials).values({
    userId,
    type: "totp",
    secretEncrypted: secret,
    label: "TOTP Authenticator",
  });

  return c.json({
    secret,
    otpauthUri,
    message: "Scan the QR code with your authenticator app, then verify with a code.",
  });
});

// POST /totp/verify - Verify TOTP code
const totpVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

authRoutes.post("/totp/verify", zValidator("json", totpVerifySchema), async (c) => {
  const userId = c.get("userId");
  const { code } = c.req.valid("json");

  const credential = await db
    .select()
    .from(mfaCredentials)
    .where(and(eq(mfaCredentials.userId, userId), eq(mfaCredentials.type, "totp"), isNull(mfaCredentials.deletedAt)));

  if (credential.length === 0) {
    throw AppError.notFound("TOTP is not configured. Set it up first.");
  }

  // Verify the TOTP code using otpauth library
  const totp = new OTPAuth.TOTP({
    issuer: "NOVA",
    label: "user",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(credential[0].secretEncrypted),
  });

  // Allow a window of 1 step (30s before/after) for clock drift
  const delta = totp.validate({ token: code, window: 1 });

  if (delta === null) {
    throw AppError.unauthorized("Invalid TOTP code");
  }

  // Update last used timestamp
  await db
    .update(mfaCredentials)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(mfaCredentials.id, credential[0].id));

  return c.json({ ok: true, message: "TOTP code verified successfully." });
});

// POST /totp/disable - Disable TOTP
authRoutes.post("/totp/disable", async (c) => {
  const userId = c.get("userId");

  const result = await db
    .update(mfaCredentials)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(mfaCredentials.userId, userId), eq(mfaCredentials.type, "totp"), isNull(mfaCredentials.deletedAt)))
    .returning();

  if (result.length === 0) {
    throw AppError.notFound("TOTP is not configured.");
  }

  return c.json({ ok: true, message: "TOTP has been disabled." });
});

// ─── Password Policy ──────────────────────────────────────

const DEFAULT_PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  preventReuse: 5,
  expiryDays: 0, // 0 = no expiry
};

// GET /password-policy - Get password policy for the org
authRoutes.get("/password-policy", async (c) => {
  const orgId = c.get("orgId");

  const settings = await db
    .select()
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, "password_policy")));

  const policy = settings[0] ? JSON.parse(settings[0].value) : DEFAULT_PASSWORD_POLICY;

  return c.json(policy);
});

// PATCH /password-policy - Admin: set password policy
const passwordPolicySchema = z.object({
  minLength: z.number().int().min(6).max(128).optional(),
  maxLength: z.number().int().min(8).max(256).optional(),
  requireUppercase: z.boolean().optional(),
  requireLowercase: z.boolean().optional(),
  requireNumbers: z.boolean().optional(),
  requireSpecialChars: z.boolean().optional(),
  preventReuse: z.number().int().min(0).max(24).optional(),
  expiryDays: z.number().int().min(0).max(365).optional(),
});

authRoutes.patch("/password-policy", requireRole("org-admin"), zValidator("json", passwordPolicySchema), async (c) => {
  const orgId = c.get("orgId");
  const updates = c.req.valid("json");

  // Load existing policy
  const settings = await db
    .select()
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, "password_policy")));

  const currentPolicy = settings[0] ? JSON.parse(settings[0].value) : DEFAULT_PASSWORD_POLICY;
  const mergedPolicy = { ...currentPolicy, ...updates };

  // Validate minLength <= maxLength
  if (mergedPolicy.minLength > mergedPolicy.maxLength) {
    throw AppError.badRequest("minLength cannot be greater than maxLength");
  }

  const policyValue = JSON.stringify(mergedPolicy);

  await db
    .insert(orgSettings)
    .values({ orgId, key: "password_policy", value: policyValue })
    .onConflictDoUpdate({
      target: [orgSettings.orgId, orgSettings.key],
      set: { value: policyValue, updatedAt: new Date() },
    });

  return c.json(mergedPolicy);
});

// ─── User Init (auto-create org + profile for new users) ──

authRoutes.post("/init", async (c) => {
  // Manually validate session since this is in public auth routes
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.session || !session?.user) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const externalId = session.user.id;
  const email = session.user.email;

  // Find or create NOVA user by Better Auth external ID
  let [novaUser] = await db
    .select()
    .from(users)
    .where(eq(users.externalId, externalId));

  if (!novaUser) {
    // Create NOVA user linked to Better Auth user
    [novaUser] = await db
      .insert(users)
      .values({
        externalId,
        email: email.toLowerCase(),
        lastLoginAt: new Date(),
      })
      .returning();
  }

  // Check if user already has a profile in any org
  const existingProfiles = await db
    .select({ orgId: userProfiles.orgId })
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, novaUser.id), isNull(userProfiles.deletedAt)));

  if (existingProfiles.length > 0) {
    // If a specific org is requested (via x-org-id header), use that if user has access
    const requestedOrgId = c.req.header("x-org-id");
    const targetOrgId = (requestedOrgId && existingProfiles.some((p) => p.orgId === requestedOrgId))
      ? requestedOrgId
      : existingProfiles[0].orgId;

    // Fetch the user's role in the target org
    const [profile] = await db
      .select({ role: userProfiles.role, displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(and(eq(userProfiles.userId, novaUser.id), eq(userProfiles.orgId, targetOrgId), isNull(userProfiles.deletedAt)));
    return c.json({ orgId: targetOrgId, role: profile?.role ?? "member", displayName: profile?.displayName });
  }

  // Create a personal org for the user
  const userName = session.user.name ?? email.split("@")[0] ?? "User";
  const slug = `${userName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40)}-${Date.now().toString(36)}`;

  const [org] = await db
    .insert(organisations)
    .values({
      name: `${userName}'s Workspace`,
      slug,
    })
    .returning();

  // Create user profile in the new org as admin
  await db.insert(userProfiles).values({
    userId: novaUser.id,
    orgId: org.id,
    displayName: userName,
    role: "org-admin",
  });

  return c.json({ orgId: org.id, role: "org-admin", displayName: userName });
});

// Better Auth catch-all handler (handles login, register, session, etc.)
// Must be last so specific routes above take priority
authRoutes.all("/*", async (c) => {
  return auth.handler(c.req.raw.clone());
});

export { authRoutes };
