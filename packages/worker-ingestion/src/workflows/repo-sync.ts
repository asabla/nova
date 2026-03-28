import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  updateConnectorSyncStatus,
  updateConnectorSyncState,
  syncRepoFiles,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 minutes",
  heartbeatTimeout: "5 minutes",
  retry: { maximumAttempts: 2 },
});

export interface RepoSyncInput {
  connectorId: string;
  orgId: string;
  collectionId: string;
}

/**
 * Temporal workflow for syncing a git repository into a knowledge collection.
 *
 * Follows the same pattern as connectorSyncWorkflow:
 * 1. Set status to "syncing"
 * 2. Run sync activity (clone → walk → chunk → embed → persist)
 * 3. Update sync state with commit SHA + count
 */
export async function repoSyncWorkflow(input: RepoSyncInput): Promise<void> {
  await updateConnectorSyncStatus(input.connectorId, "syncing");

  try {
    const result = await syncRepoFiles({
      connectorId: input.connectorId,
      orgId: input.orgId,
      collectionId: input.collectionId,
    });

    await updateConnectorSyncState(input.connectorId, {
      lastSyncStatus: "success",
      lastSyncAt: new Date().toISOString(),
      deltaCursor: result.deltaCursor,
      syncedDocumentCount: result.syncedDocumentCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await updateConnectorSyncStatus(input.connectorId, "failed", message);
    throw err;
  }
}
