import { Worker, NativeConnection } from "@temporalio/worker";
import * as activities from "./activities";
import { setupSchedules } from "./scheduler";
import { env } from "./lib/env";
import { closeDb } from "./lib/db";
import { closeRedis } from "./lib/redis";

async function run() {
  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: "nova-main",
    workflowsPath: new URL("./workflows/index.js", import.meta.url).pathname,
    activities,
    maxConcurrentActivityTaskExecutions: env.WORKER_MAX_ACTIVITIES,
    maxConcurrentWorkflowTaskExecutions: env.WORKER_MAX_WORKFLOWS,
  });

  console.log("Temporal worker started on task queue: nova-main");

  // Register schedules before starting the worker poll loop
  await setupSchedules();

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down worker...");
    worker.shutdown();
    await closeDb();
    await closeRedis();
    await connection.close();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
