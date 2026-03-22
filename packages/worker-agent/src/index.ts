import { Worker, NativeConnection } from "@temporalio/worker";
import { Connection, Client } from "@temporalio/client";
import * as activities from "./activities";
import { env } from "@nova/worker-shared/env";
import { closeDb } from "@nova/worker-shared/db";
import { closeRedis } from "@nova/worker-shared/redis";

const TASK_QUEUE = "nova-agent";
const DEPLOYMENT_NAME = "nova-worker-agent";

async function run() {
  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUE,
    workflowsPath: new URL("./workflows/index.js", import.meta.url).pathname,
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

  console.log(`Temporal worker started on task queue: ${TASK_QUEUE}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down agent worker...");
    worker.shutdown();
    await closeDb();
    await closeRedis();
    await connection.close();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Start worker polling, then set deployment version
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
        console.log(`Deployment version ${DEPLOYMENT_NAME}:${env.WORKER_BUILD_ID} set as current`);
        await clientConn.close();
        return;
      } catch (err) {
        if (i < retries - 1) {
          console.warn(`Failed to set deployment version (attempt ${i + 1}/${retries}), retrying...`);
        } else {
          console.warn("Failed to set deployment version after all retries:", err);
        }
      }
    }
  };

  setDeploymentVersion().catch(() => {});

  await runPromise;
}

run().catch((err) => {
  console.error("Agent worker failed:", err);
  process.exit(1);
});
