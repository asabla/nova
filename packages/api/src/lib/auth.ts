import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as authSchema from "./auth-schema";

// Separate drizzle instance with Better Auth's own schema
const authClient = postgres(env.DATABASE_URL);
const authDb = drizzle(authClient, { schema: authSchema });

// Cast cuts tsc's deep inference chain for betterAuth() — without this, tsc
// computes a massive return type pulling in 136+ better-auth and 251 kysely
// type files, causing OOM. Only auth.api.getSession() and auth.handler() are used.
export const auth = betterAuth({
  database: drizzleAdapter(authDb, { provider: "pg", schema: authSchema }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  trustedOrigins: env.CORS_ORIGINS.split(","),
  session: {
    expiresIn: 60 * 60 * 24,
  },
  advanced: {
    cookiePrefix: "nova",
    cookies: {
      session_token: {
        name: "nova_session",
        attributes: {
          httpOnly: true,
          sameSite: "lax" as const,
          secure: env.NODE_ENV === "production",
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
    }),
  ],
}) as unknown as {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (opts: { headers: Headers }) => Promise<{
      session: { id: string; userId: string; token: string; expiresAt: Date; activeOrganizationId: string | null };
      user: { id: string; name: string; email: string; emailVerified: boolean; image: string | null; createdAt: Date; updatedAt: Date };
    } | null>;
  };
};
