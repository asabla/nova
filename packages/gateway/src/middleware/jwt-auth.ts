import type { Context, Next } from "hono";
import * as jose from "jose";

const GATEWAY_JWT_SECRET = process.env.NOVA_GATEWAY_JWT_SECRET ?? "dev-gateway-secret";

/**
 * JWT authentication middleware for the Gateway.
 *
 * Workers receive a scoped JWT from the proxy activity. The JWT contains:
 * - orgId: organization context for all queries
 * - conversationId: optional, scopes stream operations
 * - workerId: which custom worker is calling
 * - scopes: allowed operation categories (e.g. ["stream", "db", "llm", "vectors", "storage"])
 * - exp: short-lived (5 minutes)
 */
export async function jwtAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(GATEWAY_JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const orgId = payload.orgId as string;
    if (!orgId) {
      return c.json({ error: "JWT missing orgId claim" }, 403);
    }

    c.set("orgId", orgId);
    c.set("conversationId", payload.conversationId as string | undefined);
    c.set("workerId", payload.workerId as string | undefined);
    c.set("scopes", (payload.scopes as string[]) ?? []);

    await next();
  } catch (err) {
    if (err instanceof jose.errors.JWTExpired) {
      return c.json({ error: "JWT expired" }, 401);
    }
    return c.json({ error: "Invalid JWT" }, 401);
  }
}

/**
 * Generate a scoped JWT for a worker to call the gateway.
 * Called by the proxy activity before dispatching to a worker.
 */
export async function generateWorkerJWT(claims: {
  orgId: string;
  conversationId?: string;
  workerId: string;
  scopes?: string[];
}): Promise<string> {
  const secret = new TextEncoder().encode(GATEWAY_JWT_SECRET);
  return new jose.SignJWT({
    orgId: claims.orgId,
    conversationId: claims.conversationId,
    workerId: claims.workerId,
    scopes: claims.scopes ?? ["stream", "db", "llm", "vectors", "storage"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}
