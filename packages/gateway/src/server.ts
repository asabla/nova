import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.GATEWAY_PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Nova Gateway listening on port ${info.port}`);
});

// Graceful shutdown
async function shutdown() {
  console.log("Gateway shutting down...");
  const { closeDb } = await import("@nova/worker-shared/db");
  const { closeRedis } = await import("@nova/worker-shared/redis");
  await Promise.allSettled([closeDb(), closeRedis()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
