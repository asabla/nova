import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";
import { RETRY_POLICIES } from "@nova/shared/constants";

const { updateDocumentStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: RETRY_POLICIES.DATABASE,
});

const { ingestDocument } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: RETRY_POLICIES.EXTERNAL,
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
