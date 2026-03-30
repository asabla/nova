/**
 * Slack outbound messaging via Incoming Webhooks.
 * Uses the webhook URL configured per-org in the integrations table.
 */

import { db } from "./db";
import { integrations } from "@nova/shared/schemas";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "./logger";

export async function sendSlackMessage(orgId: string, message: string, opts?: { channel?: string }): Promise<boolean> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(
      eq(integrations.orgId, orgId),
      eq(integrations.type, "slack"),
      eq(integrations.isEnabled, true),
      isNull(integrations.deletedAt),
    ));

  if (!integration) return false;

  const config = integration.config as { webhookUrl?: string; channel?: string } | null;
  const webhookUrl = config?.webhookUrl;
  if (!webhookUrl) return false;

  try {
    const payload: Record<string, unknown> = {
      text: message,
    };
    if (opts?.channel || config?.channel) {
      payload.channel = opts?.channel || config?.channel;
    }

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    return resp.ok;
  } catch {
    logger.warn({ orgId }, "[SLACK] Failed to send message");
    return false;
  }
}
