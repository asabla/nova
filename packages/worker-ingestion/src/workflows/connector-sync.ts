import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  updateConnectorSyncStatus,
  syncConnectorDocuments,
  updateConnectorSyncState,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 minutes",
  retry: { maximumAttempts: 2 },
});

export interface ConnectorSyncInput {
  connectorId: string;
  orgId: string;
  collectionId: string;
}

export async function connectorSyncWorkflow(input: ConnectorSyncInput): Promise<void> {
  await updateConnectorSyncStatus(input.connectorId, "syncing");

  try {
    // Single activity handles: token acquisition → delta fetch → download → store → ingest
    // This avoids passing large data through Temporal's 4MB gRPC limit
    const result = await syncConnectorDocuments(input);

    await updateConnectorSyncState(input.connectorId, {
      lastSyncStatus: "success",
      lastSyncAt: new Date().toISOString(),
      deltaCursor: result.deltaCursor ?? null,
      syncedDocumentCount: result.syncedDocumentCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await updateConnectorSyncStatus(input.connectorId, "failed", message);
    throw err;
  }
}
