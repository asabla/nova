import { createMiddleware } from "hono/factory";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { orgSettings, mfaCredentials } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

/**
 * MFA enforcement middleware (Story #6).
 *
 * When an org has `mfaRequired: true` in its security policies,
 * this middleware blocks access for users who have not yet set up
 * a TOTP credential. The TOTP setup/verify/disable routes are
 * excluded so that users can still enroll.
 */
export const mfaGuard = () =>
  createMiddleware(async (c, next) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");

    if (!orgId || !userId) {
      await next();
      return;
    }

    // Skip MFA check for auth/TOTP routes so users can enroll
    const path = c.req.path;
    if (
      path.startsWith("/api/auth/totp") ||
      path.startsWith("/api/auth/session") ||
      path.startsWith("/health")
    ) {
      await next();
      return;
    }

    // Check if org requires MFA
    const [policySetting] = await db
      .select()
      .from(orgSettings)
      .where(
        and(
          eq(orgSettings.orgId, orgId),
          eq(orgSettings.key, "security_policies"),
        ),
      );

    if (!policySetting) {
      await next();
      return;
    }

    let mfaRequired = false;
    try {
      const policies = JSON.parse(policySetting.value);
      mfaRequired = policies.mfaRequired === true;
    } catch {
      // Invalid JSON, skip enforcement
    }

    if (!mfaRequired) {
      await next();
      return;
    }

    // Check if the user has an active TOTP credential
    const [credential] = await db
      .select({ id: mfaCredentials.id })
      .from(mfaCredentials)
      .where(
        and(
          eq(mfaCredentials.userId, userId),
          eq(mfaCredentials.type, "totp"),
          isNull(mfaCredentials.deletedAt),
        ),
      );

    if (!credential) {
      throw new AppError(
        403,
        "MFA Required",
        "Your organization requires multi-factor authentication. Please set up TOTP in your security settings before continuing.",
        "https://nova.dev/errors/mfa-required",
      );
    }

    await next();
  });
