import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const { computeAggregates, getOrgsWithEvalsEnabled } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 2 },
});

/**
 * Daily scheduled workflow that computes eval aggregates for all orgs.
 */
export async function evalAggregateWorkflow(): Promise<{ orgsProcessed: number }> {
  const orgIds = await getOrgsWithEvalsEnabled();

  for (const orgId of orgIds) {
    await computeAggregates({ orgId });
  }

  return { orgsProcessed: orgIds.length };
}
