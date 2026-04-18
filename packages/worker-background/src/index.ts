import { initTelemetry } from "@nova/worker-shared/telemetry";
initTelemetry("nova-worker-background");

import path from "node:path";
import { runWorker } from "@nova/worker-shared/run-worker";
import { logger } from "@nova/worker-shared/logger";
import * as activities from "./activities";
import { setupSchedules } from "./scheduler";

const WORKFLOW_BUNDLE_PATH = path.resolve(import.meta.dirname, "workflow-bundle.js");

runWorker({
  serviceName: "background",
  taskQueue: "nova-background",
  deploymentName: "nova-worker-background",
  importMeta: import.meta,
  workflowBundlePath: WORKFLOW_BUNDLE_PATH,
  activities,
  beforeStart: setupSchedules,
}).catch((err: unknown) => {
  logger.error({ err }, "Background worker failed");
  process.exit(1);
});
