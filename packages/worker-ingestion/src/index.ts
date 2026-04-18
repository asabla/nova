import { initTelemetry } from "@nova/worker-shared/telemetry";
initTelemetry("nova-worker-ingestion");

import path from "node:path";
import { runWorker } from "@nova/worker-shared/run-worker";
import { logger } from "@nova/worker-shared/logger";
import * as activities from "./activities/index.js";

const WORKFLOW_BUNDLE_PATH = path.resolve(import.meta.dirname, "workflow-bundle.js");

runWorker({
  serviceName: "ingestion",
  taskQueue: "nova-ingestion",
  deploymentName: "nova-worker-ingestion",
  importMeta: import.meta,
  workflowBundlePath: WORKFLOW_BUNDLE_PATH,
  activities,
}).catch((err: unknown) => {
  logger.error({ err }, "Ingestion worker failed");
  process.exit(1);
});
