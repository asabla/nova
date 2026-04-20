import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";
import { RETRY_POLICIES } from "@nova/shared/constants";

const { embedAndIndexMessage } = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: RETRY_POLICIES.EXTERNAL,
});

export interface MessageEmbeddingInput {
  messageId: string;
  orgId: string;
}

export async function messageEmbeddingWorkflow(input: MessageEmbeddingInput): Promise<void> {
  await embedAndIndexMessage(input.messageId, input.orgId);
}
