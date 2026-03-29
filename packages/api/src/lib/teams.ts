/**
 * Microsoft Teams outbound messaging via Incoming Webhooks.
 * Uses Adaptive Card format for rich messages.
 */

import { db } from "./db";
import { integrations } from "@nova/shared/schemas";
import { eq, and, isNull } from "drizzle-orm";

export async function sendTeamsMessage(orgId: string, message: string, opts?: { title?: string }): Promise<boolean> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(
      eq(integrations.orgId, orgId),
      eq(integrations.type, "teams"),
      eq(integrations.isEnabled, true),
      isNull(integrations.deletedAt),
    ));

  if (!integration) return false;

  const config = integration.config as { webhookUrl?: string } | null;
  const webhookUrl = config?.webhookUrl;
  if (!webhookUrl) return false;

  try {
    // Adaptive Card format for Teams
    const payload = {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            ...(opts?.title ? [{
              type: "TextBlock",
              text: opts.title,
              weight: "Bolder",
              size: "Medium",
            }] : []),
            {
              type: "TextBlock",
              text: message,
              wrap: true,
            },
          ],
        },
      }],
    };

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    return resp.ok;
  } catch {
    console.warn(`[TEAMS] Failed to send message to org ${orgId}`);
    return false;
  }
}
