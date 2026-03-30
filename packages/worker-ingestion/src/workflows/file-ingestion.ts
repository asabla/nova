import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";
import { RETRY_POLICIES } from "@nova/shared/constants";

const { ingestFileContent } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: RETRY_POLICIES.EXTERNAL,
});

export interface FileIngestionInput {
  fileId: string;
  orgId: string;
}

export async function fileIngestionWorkflow(input: FileIngestionInput): Promise<void> {
  await ingestFileContent(input.fileId, input.orgId);
}
