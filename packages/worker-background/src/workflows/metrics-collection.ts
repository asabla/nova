import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";
import { RETRY_POLICIES } from "@nova/shared/constants";

const {
  collectPlatformMetrics,
  backfillPlatformMetrics,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: RETRY_POLICIES.DATABASE,
});

/**
 * Scheduled workflow that collects platform metrics.
 * Run via Temporal schedule: every hour.
 */
export async function metricsCollectionWorkflow(): Promise<{
  snapshotsCreated: number;
}> {
  const result = await collectPlatformMetrics();
  return result;
}

/**
 * One-time workflow to backfill historical metrics from existing data.
 * Run manually: `temporal workflow execute --task-queue nova-background --type backfillMetricsWorkflow --input '{"days": 90}'`
 */
export async function backfillMetricsWorkflow(input?: { days?: number }): Promise<{
  snapshotsCreated: number;
}> {
  const result = await backfillPlatformMetrics(input?.days ?? 90);
  return result;
}
