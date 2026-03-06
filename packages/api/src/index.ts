import { app } from "./app";
import { env } from "./lib/env";
import { ensureBucket } from "./lib/minio";

await ensureBucket();

Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
  idleTimeout: 0,
});

console.log(`NOVA API server running on port ${env.PORT}`);
