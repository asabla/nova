import { app } from "./app";
import { env } from "./lib/env";
import { ensureBucket } from "./lib/minio";
import { handleWsUpgrade, handleWsClose, handleWsMessage, initWsPubSub, type WSData } from "./lib/ws";

await ensureBucket();
initWsPubSub();

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

console.log(`NOVA API server running on port ${env.PORT}`);
