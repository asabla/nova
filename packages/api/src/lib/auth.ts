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

export const auth = betterAuth({
  database: drizzleAdapter(authDb, { provider: "pg", schema: authSchema }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  trustedOrigins: env.CORS_ORIGINS.split(","),
  session: {
    cookieName: "nova_session",
    expiresIn: 60 * 60 * 24,
    cookie: {
      httpOnly: true,
      sameSite: "strict" as const,
      secure: env.NODE_ENV === "production",
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
});
