import { Worker, NativeConnection } from "@temporalio/worker";
import { Connection, Client } from "@temporalio/client";
import path from "node:path";
import * as activities from "./activities";
import { env } from "@nova/worker-shared/env";
import { closeDb } from "@nova/worker-shared/db";
import { closeRedis } from "@nova/worker-shared/redis";
import { logger } from "@nova/worker-shared/logger";

const TASK_QUEUE = "nova-ingestion";
const DEPLOYMENT_NAME = "nova-worker-ingestion";

async function run() {
  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUE,
    workflowsPath: import.meta.filename.endsWith(".ts")
      ? path.resolve(import.meta.dirname, "workflows/index.ts")
      : new URL("./workflows/index.js", import.meta.url).pathname,
    activities,
    maxConcurrentActivityTaskExecutions: env.WORKER_MAX_ACTIVITIES,
    maxConcurrentWorkflowTaskExecutions: env.WORKER_MAX_WORKFLOWS,
    workerDeploymentOptions: {
      version: {
        buildId: env.WORKER_BUILD_ID,
        deploymentName: DEPLOYMENT_NAME,
      },
      useWorkerVersioning: true,
      defaultVersioningBehavior: "AUTO_UPGRADE",
    },
  });

  logger.info({ taskQueue: TASK_QUEUE }, "Temporal worker started");

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down ingestion worker...");
    await worker.shutdown();
    await closeDb();
    await closeRedis();
    await connection.close();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  const runPromise = worker.run();

  const setDeploymentVersion = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      try {
        const clientConn = await Connection.connect({ address: env.TEMPORAL_ADDRESS });
        const client = new Client({ connection: clientConn, namespace: env.TEMPORAL_NAMESPACE });
        await client.workflowService.setWorkerDeploymentCurrentVersion({
          namespace: env.TEMPORAL_NAMESPACE,
          deploymentName: DEPLOYMENT_NAME,
          buildId: env.WORKER_BUILD_ID,
        });
        logger.info({ deploymentName: DEPLOYMENT_NAME, buildId: env.WORKER_BUILD_ID }, "Deployment version set as current");
        await clientConn.close();
        return;
      } catch (err) {
        if (i < retries - 1) {
          logger.warn({ attempt: i + 1, retries }, "Failed to set deployment version, retrying...");
        } else {
          logger.warn({ err }, "Failed to set deployment version after all retries");
        }
      }
    }
  };

  setDeploymentVersion().catch((err) => logger.error({ err }, "deployment version setup failed completely"));

  await runPromise;
}

run().catch((err) => {
  logger.error({ err }, "Ingestion worker failed");
  process.exit(1);
});
