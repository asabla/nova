import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  getConversationMessages,
  generateSummary,
  updateConversationTitle,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 },
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
