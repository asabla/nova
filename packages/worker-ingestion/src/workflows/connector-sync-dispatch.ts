import { proxyActivities, startChild } from "@temporalio/workflow";
import type * as activities from "../activities";
import { RETRY_POLICIES } from "@nova/shared/constants";
import { connectorSyncWorkflow } from "./connector-sync.js";

const { findConnectorsDueForSync } = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: RETRY_POLICIES.DATABASE,
});

/**
 * Dispatch workflow that runs on a schedule (every 30 min).
 * Finds connectors due for sync and starts a child sync workflow for each.
 */
export async function connectorSyncDispatchWorkflow(): Promise<void> {
  const connectors = await findConnectorsDueForSync();

  for (const connector of connectors) {
    try {
      await startChild(connectorSyncWorkflow, {
        workflowId: `connector-sync-${connector.id}`,
        args: [{
          connectorId: connector.id,
          orgId: connector.orgId,
          collectionId: connector.knowledgeCollectionId,
        }],
      });
    } catch {
      // Workflow may already be running (duplicate ID) — skip
    }
  }
}
