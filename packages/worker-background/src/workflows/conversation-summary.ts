import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";
import { RETRY_POLICIES } from "@nova/shared/constants";

const {
  getConversationMessages,
  updateConversationTitle,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: RETRY_POLICIES.DATABASE,
});

const {
  generateSummary,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: RETRY_POLICIES.EXTERNAL,
});

export interface ConversationSummaryInput {
  orgId: string;
  conversationId: string;
}

export async function conversationSummaryWorkflow(input: ConversationSummaryInput): Promise<string> {
  const messages = await getConversationMessages(input.conversationId);

  if (messages.length < 2) return "";

  const summary = await generateSummary(messages);
  await updateConversationTitle(input.conversationId, summary);
  return summary;
}
