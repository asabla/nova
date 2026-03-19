import { Worker, NativeConnection } from "@temporalio/worker";
import * as activities from "./activities";
import { setupSchedules } from "./scheduler";

async function run() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    taskQueue: "nova-main",
    workflowsPath: new URL("./workflows/index.js", import.meta.url).pathname,
    activities,
    maxConcurrentActivityTaskExecutions: parseInt(process.env.WORKER_MAX_ACTIVITIES ?? "10", 10),
    maxConcurrentWorkflowTaskExecutions: parseInt(process.env.WORKER_MAX_WORKFLOWS ?? "40", 10),
  });

  console.log("Temporal worker started on task queue: nova-main");

  // Register schedules before starting the worker poll loop
  await setupSchedules();

  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
