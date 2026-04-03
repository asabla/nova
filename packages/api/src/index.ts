import { initTelemetry, shutdownTelemetry } from "./lib/telemetry";
initTelemetry();

import { app } from "./app";
import { adminApp } from "./admin-app";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { ensureBucket } from "./lib/s3";
import { ensureAllCollections } from "./lib/qdrant";
import { handleWsUpgrade, handleWsClose, handleWsMessage, initWsPubSub, type WSData } from "./lib/ws";
import { auth } from "./lib/auth";
import { db } from "./lib/db";
import { users } from "@nova/shared/schemas";
import { eq } from "drizzle-orm";

await ensureBucket();
initWsPubSub();
ensureAllCollections().catch((err) => logger.error({ err }, "[startup] Qdrant collection setup failed"));

Bun.serve<WSData>({
  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade — authenticate via session cookie
    if (url.pathname === "/ws") {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session?.session || !session?.user) {
        return new Response("Unauthorized", { status: 401 });
      }

      // Resolve NOVA user ID from Better Auth external ID
      const [novaUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalId, session.user.id));

      const userId = novaUser?.id ?? session.user.id;
      const orgId = req.headers.get("x-org-id") ?? "default";

      const upgraded = server.upgrade(req, {
        data: { userId, orgId },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Route admin API requests to the separate admin app
    if (url.pathname.startsWith("/admin-api")) {
      return adminApp.fetch(req);
    }

    return app.fetch(req, server);
  },
  websocket: {
    open(ws) {
      handleWsUpgrade(ws);
    },
    message(ws, message) {
      handleWsMessage(ws, typeof message === "string" ? message : new TextDecoder().decode(message));
    },
    close(ws) {
      handleWsClose(ws);
    },
  },
  port: env.PORT,
  idleTimeout: 0,
});

logger.info({ port: env.PORT }, "NOVA API server running");
