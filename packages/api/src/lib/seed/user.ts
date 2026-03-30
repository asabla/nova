import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users, userProfiles } from "@nova/shared/schemas";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as authSchema from "../auth-schema";

export const SEED_USER = {
  name: "Admin",
  email: "admin@nova.local",
  password: "Admin123!",
};

async function ensureAuthTables(authClient: postgres.Sql) {
  await authClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      image TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "session" (
      id TEXT PRIMARY KEY,
      expires_at TIMESTAMP NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now(),
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES "user"(id),
      active_organization_id TEXT
    );
    CREATE TABLE IF NOT EXISTS "account" (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES "user"(id),
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at TIMESTAMP,
      refresh_token_expires_at TIMESTAMP,
      scope TEXT,
      password TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "verification" (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "organization" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      logo TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS "member" (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES "organization"(id),
      user_id TEXT NOT NULL REFERENCES "user"(id),
      role TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "invitation" (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES "organization"(id),
      email TEXT NOT NULL,
      role TEXT,
      status TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      inviter_id TEXT NOT NULL REFERENCES "user"(id)
    );
  `);
}

export async function seedUser(orgId: string): Promise<{ userId: string; cleanup: () => Promise<void> }> {
  const authClient = postgres(env.DATABASE_URL);
  const authDb = drizzle(authClient, { schema: authSchema });

  // Ensure Better Auth tables exist (they're managed by Better Auth, not Drizzle migrations)
  await ensureAuthTables(authClient);

  const hashedPassword = await hashPassword(SEED_USER.password);

  // Check if Better Auth user already exists
  const existingAuthUsers = await authDb.select().from(authSchema.user).where(eq(authSchema.user.email, SEED_USER.email));
  let betterAuthId: string;

  if (existingAuthUsers.length > 0) {
    betterAuthId = existingAuthUsers[0].id;
    await authDb
      .update(authSchema.account)
      .set({ password: hashedPassword })
      .where(eq(authSchema.account.userId, betterAuthId));
  } else {
    betterAuthId = crypto.randomUUID();

    await authDb.insert(authSchema.user).values({
      id: betterAuthId,
      name: SEED_USER.name,
      email: SEED_USER.email,
      emailVerified: true,
    });

    await authDb.insert(authSchema.account).values({
      id: crypto.randomUUID(),
      accountId: betterAuthId,
      providerId: "credential",
      userId: betterAuthId,
      password: hashedPassword,
    });
  }

  // NOVA users table
  const [novaUser] = await db
    .insert(users)
    .values({
      externalId: betterAuthId,
      email: SEED_USER.email,
      isSuperAdmin: true,
      lastLoginAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  const userId = novaUser?.id ?? (await db.select().from(users).where(eq(users.externalId, betterAuthId)).then((r) => r[0]!.id));

  // User profile (org-admin)
  await db
    .insert(userProfiles)
    .values({
      userId,
      orgId,
      displayName: SEED_USER.name,
      role: "org-admin",
      onboardingCompletedAt: new Date(),
    })
    .onConflictDoNothing();

  console.log(`  User: ${SEED_USER.email} / ${SEED_USER.password}`);

  return {
    userId,
    cleanup: () => authClient.end(),
  };
}
