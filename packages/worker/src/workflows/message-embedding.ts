import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const { embedAndIndexMessage } = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 },
});

export interface MessageEmbeddingInput {
  messageId: string;
  orgId: string;
}

export async function messageEmbeddingWorkflow(input: MessageEmbeddingInput): Promise<void> {
  await embedAndIndexMessage(input.messageId, input.orgId);
}
