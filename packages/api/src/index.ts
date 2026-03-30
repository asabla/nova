import { app } from "./app";
import { adminApp } from "./admin-app";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { ensureBucket } from "./lib/minio";
import { ensureAllCollections } from "./lib/qdrant";
import { handleWsUpgrade, handleWsClose, handleWsMessage, initWsPubSub, type WSData } from "./lib/ws";

await ensureBucket();
initWsPubSub();
ensureAllCollections().catch((err) => logger.error({ err }, "[startup] Qdrant collection setup failed"));

Bun.serve<WSData>({
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: {
          userId: req.headers.get("x-user-id") ?? "anonymous",
          orgId: req.headers.get("x-org-id") ?? "default",
        },
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
