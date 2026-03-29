import { getDb } from "@nova/worker-shared/db";
import { notifications, notificationPreferences, users, integrations } from "@nova/shared/schemas";
import { eq, and, isNull } from "drizzle-orm";

export async function notifyAgentCompleteActivity(input: {
  orgId: string;
  userId: string;
  agentName: string;
  conversationId: string;
}): Promise<void> {
  const db = getDb();
  const { orgId, userId, agentName, conversationId } = input;

  // Create in-app notification
  await db.insert(notifications).values({
    orgId,
    userId,
    type: "agent_complete",
    title: `${agentName} finished`,
    body: "Your agent run has completed.",
    resourceType: "conversation",
    resourceId: conversationId,
  });

  // Check for Slack integration and send
  const [slackIntegration] = await db
    .select()
    .from(integrations)
    .where(and(
      eq(integrations.orgId, orgId),
      eq(integrations.type, "slack"),
      eq(integrations.isEnabled, true),
      isNull(integrations.deletedAt),
    ));

  if (slackIntegration) {
    const config = slackIntegration.config as { webhookUrl?: string } | null;
    if (config?.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `Agent "${agentName}" has completed its run.` }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Non-critical
      }
    }
  }

  // Check for Teams integration and send
  const [teamsIntegration] = await db
    .select()
    .from(integrations)
    .where(and(
      eq(integrations.orgId, orgId),
      eq(integrations.type, "teams"),
      eq(integrations.isEnabled, true),
      isNull(integrations.deletedAt),
    ));

  if (teamsIntegration) {
    const config = teamsIntegration.config as { webhookUrl?: string } | null;
    if (config?.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "message",
            attachments: [{
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.4",
                body: [
                  { type: "TextBlock", text: "Agent Complete", weight: "Bolder", size: "Medium" },
                  { type: "TextBlock", text: `Agent "${agentName}" has completed its run.`, wrap: true },
                ],
              },
            }],
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Non-critical
      }
    }
  }
}
