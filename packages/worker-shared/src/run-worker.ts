/**
 * Shared runner for Nova Temporal workers.
 *
 * Owns boilerplate that's the same across worker-agent, worker-ingestion, and
 * worker-background: NativeConnection setup, Worker.create, deployment
 * version registration, SIGTERM/SIGINT handling, and clean shutdown.
 *
 * NOTE: callers must still call `initTelemetry(serviceName)` at the very top
 * of their entry module BEFORE importing this file or `@temporalio/worker`.
 * OTel HTTP instrumentation only patches `http` if it loads first.
 */

import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { Worker, NativeConnection, type WorkerOptions } from "@temporalio/worker";
import { Connection, Client } from "@temporalio/client";
import { env } from "./env";
import { closeDb } from "./db";
import { closeRedis } from "./redis";
import { logger } from "./logger";
import { shutdownTelemetry } from "./telemetry";

export interface RunWorkerOptions {
  /** Human-readable name used for startup/shutdown log lines, e.g. "agent". */
  serviceName: string;
  /** Temporal task queue, e.g. "nova-agent". */
  taskQueue: string;
  /** Temporal worker deployment name, e.g. "nova-worker-agent". */
  deploymentName: string;
  /**
   * `import.meta` from the caller's entry file. Used to compute `workflowsPath`
   * relative to the caller's source — required when no pre-built bundle exists.
   */
  importMeta: ImportMeta;
  /**
   * Entry path for workflows, relative to the caller's directory, without
   * extension. Defaults to "./workflows/index".
   */
  workflowsEntry?: string;
  /**
   * Absolute path to a pre-built workflow bundle (see `bundleWorkflowCode`).
   * When the file exists, it's loaded and passed as `workflowBundle` instead
   * of `workflowsPath`. Lets production use a pre-compiled bundle while dev
   * keeps hot-reloading source.
   */
  workflowBundlePath?: string;
  /** Activity implementations registered with the worker. */
  activities: object;
  /** Optional hook invoked after Worker.create but before worker.run. */
  beforeStart?: () => Promise<void>;
}

export async function runWorker(opts: RunWorkerOptions): Promise<void> {
  const {
    serviceName,
    taskQueue,
    deploymentName,
    importMeta,
    workflowsEntry = "./workflows/index",
    workflowBundlePath,
    activities,
    beforeStart,
  } = opts;

  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  const workflowOption = resolveWorkflowOption({
    importMeta,
    workflowsEntry,
    workflowBundlePath,
  });

  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue,
    ...workflowOption,
    activities,
    maxConcurrentActivityTaskExecutions: env.WORKER_MAX_ACTIVITIES,
    maxConcurrentWorkflowTaskExecutions: env.WORKER_MAX_WORKFLOWS,
    workerDeploymentOptions: {
      version: {
        buildId: env.WORKER_BUILD_ID,
        deploymentName,
      },
      useWorkerVersioning: true,
      defaultVersioningBehavior: "AUTO_UPGRADE",
    },
  });

  logger.info({ taskQueue }, "Temporal worker started");

  const shutdown = async () => {
    logger.info({ serviceName }, `Shutting down ${serviceName} worker...`);
    await worker.shutdown();
    await shutdownTelemetry();
    await closeDb();
    await closeRedis();
    await connection.close();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  if (beforeStart) await beforeStart();

  const runPromise = worker.run();
  setDeploymentVersion(deploymentName).catch((err) =>
    logger.error({ err }, "deployment version setup failed completely"),
  );

  await runPromise;
}

function resolveWorkflowOption(args: {
  importMeta: ImportMeta;
  workflowsEntry: string;
  workflowBundlePath?: string;
}): Pick<WorkerOptions, "workflowBundle" | "workflowsPath"> {
  if (args.workflowBundlePath && existsSync(args.workflowBundlePath)) {
    return {
      workflowBundle: {
        code: readFileSync(args.workflowBundlePath, "utf8"),
      },
    };
  }

  const isSource = args.importMeta.filename.endsWith(".ts");
  const workflowsPath = isSource
    ? path.resolve(args.importMeta.dirname, `${args.workflowsEntry}.ts`)
    : new URL(`${args.workflowsEntry}.js`, args.importMeta.url).pathname;
  return { workflowsPath };
}

async function setDeploymentVersion(deploymentName: string, retries = 5): Promise<void> {
  for (let i = 0; i < retries; i++) {
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    try {
      const clientConn = await Connection.connect({ address: env.TEMPORAL_ADDRESS });
      const client = new Client({ connection: clientConn, namespace: env.TEMPORAL_NAMESPACE });
      await client.workflowService.setWorkerDeploymentCurrentVersion({
        namespace: env.TEMPORAL_NAMESPACE,
        deploymentName,
        buildId: env.WORKER_BUILD_ID,
      });
      logger.info(
        { deploymentName, buildId: env.WORKER_BUILD_ID },
        "Deployment version set as current",
      );
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
}
