import { proxyActivities, executeChild } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";
import { RETRY_POLICIES } from "@nova/shared/constants";

const { getUnsummarizedConversations } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: RETRY_POLICIES.DATABASE,
});

export interface ConversationSummaryBatchInput {
  batchSize: number;
}

export interface ConversationSummaryBatchResult {
  processed: number;
  failed: number;
}

export async function conversationSummaryBatchWorkflow(
  input: ConversationSummaryBatchInput,
): Promise<ConversationSummaryBatchResult> {
  const conversations = await getUnsummarizedConversations(input.batchSize);

  if (conversations.length === 0) {
    return { processed: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    conversations.map((conv) =>
      executeChild("conversationSummaryWorkflow", {
        workflowId: `summary-${conv.conversationId}`,
        taskQueue: "nova-background",
        args: [{ orgId: conv.orgId, conversationId: conv.conversationId }],
      }),
    ),
  );

  const failed = results.filter((r) => r.status === "rejected").length;

  return {
    processed: conversations.length - failed,
    failed,
  };
}
