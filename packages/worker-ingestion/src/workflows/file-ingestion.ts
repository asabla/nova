import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const { ingestFileContent } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 3 },
});

export interface FileIngestionInput {
  fileId: string;
  orgId: string;
}

export async function fileIngestionWorkflow(input: FileIngestionInput): Promise<void> {
  await ingestFileContent(input.fileId, input.orgId);
}
