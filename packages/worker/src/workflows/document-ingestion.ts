import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  fetchDocumentContent,
  chunkDocument,
  generateEmbeddings,
  storeChunks,
  updateDocumentStatus,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
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
    const content = await fetchDocumentContent(input);
    const chunks = await chunkDocument(input.documentId, content);
    const embeddings = await generateEmbeddings(chunks);
    await storeChunks(input.documentId, input.collectionId, embeddings);
    await updateDocumentStatus(input.documentId, "ready");
  } catch (err) {
    await updateDocumentStatus(input.documentId, "failed");
    throw err;
  }
}
