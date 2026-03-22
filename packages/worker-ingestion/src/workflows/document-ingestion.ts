import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  ingestDocument,
  updateDocumentStatus,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 3 },
});

export interface DocumentIngestionInput {
  orgId: string;
  collectionId: string;
  documentId: string;
  fileId?: string;
  sourceUrl?: string;
}

export async function documentIngestionWorkflow(input: DocumentIngestionInput): Promise<void> {
  await updateDocumentStatus(input.documentId, "processing");

  try {
    // Single activity handles fetch → chunk → embed → store
    // This avoids passing large data through Temporal's 4MB gRPC limit
    await ingestDocument(input);
    await updateDocumentStatus(input.documentId, "ready");
  } catch (err) {
    await updateDocumentStatus(input.documentId, "failed");
    throw err;
  }
}
