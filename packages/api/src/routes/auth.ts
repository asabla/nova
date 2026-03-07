import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { auth } from "../lib/auth";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { mfaCredentials, users } from "@nova/shared/schemas";
import { orgSettings } from "@nova/shared/schemas";
import { eq, and, isNull } from "drizzle-orm";
import { AppError } from "@nova/shared/utils";
import { requireRole } from "../middleware/rbac";
import { randomBytes, createHash } from "crypto";

const authRoutes = new Hono<AppContext>();

// Better Auth catch-all handler (handles login, register, session, etc.)
authRoutes.all("/better-auth/*", (c) => auth.handler(c.req.raw));

// ─── Magic Link ───────────────────────────────────────────

const magicLinkSchema = z.object({
  email: z.string().email(),
});

// POST /magic-link - Send magic link email (stub: generates token and returns it)
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

  // Stub: In production, store the token hash and send an email.
  // For now, return the token directly for development/testing.
  return c.json({
    ok: true,
    message: "If the email exists, a magic link has been sent.",
    // DEV ONLY: In production, remove the token from the response and send via email
    _dev: {
      token,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      userId: user[0].id,
    },
  });
});

// POST /magic-link/verify - Verify magic link token
const magicLinkVerifySchema = z.object({
  token: z.string().min(1),
});

authRoutes.post("/magic-link/verify", zValidator("json", magicLinkVerifySchema), async (c) => {
  const { token } = c.req.valid("json");

  // In production, look up the token hash in the database and verify expiry.
  // Stub: validate token format and return a placeholder response.
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Stub: This would verify against stored tokens in a real implementation
  return c.json({
    ok: true,
    message: "Magic link verification stub. Implement token storage to complete.",
    tokenHash,
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

  // Generate a random secret (base32-compatible)
  const secretBytes = randomBytes(20);
  const secret = secretBytes.toString("hex");

  // Build otpauth URI for QR code scanning
  const issuer = "NOVA";
  const otpauthUri = `otpauth://totp/${issuer}:user?secret=${secret}&issuer=${issuer}&digits=6&period=30`;

  // Store the secret (encrypted in production)
  await db.insert(mfaCredentials).values({
    userId,
    type: "totp",
    secretEncrypted: secret, // In production, encrypt this
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

  // Stub: In production, use a TOTP library (e.g., otpauth) to verify the code
  // against the stored secret. For now, accept any valid 6-digit code for development.
  const isValid = code.length === 6;

  if (!isValid) {
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

export { authRoutes };
