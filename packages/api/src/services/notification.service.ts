import { db } from "../lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { notifications, users, orgSettings } from "@nova/shared/schemas";
import { sendToUser } from "../lib/ws";
import { sendEmail, buildNotificationEmail } from "../lib/email";
import { env } from "../lib/env";

interface NotificationPrefs {
  emailOnShare?: boolean;
  emailOnMention?: boolean;
  emailOnAgentComplete?: boolean;
  webhookOnAgentComplete?: boolean;
  webhookUrl?: string;
}

async function getUserPrefs(orgId: string, userId: string): Promise<NotificationPrefs> {
  const [row] = await db.select().from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, `notification_prefs_${userId}`)));
  return (row?.value as NotificationPrefs) ?? { emailOnShare: true, emailOnMention: true, emailOnAgentComplete: false };
}

async function getUserEmail(userId: string): Promise<string | null> {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return user?.email ?? null;
}

async function sendWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.warn(`[WEBHOOK] Failed to deliver to ${url}`);
  }
}

export const notificationService = {
  async create(data: {
    orgId: string;
    userId: string;
    type: string;
    title: string;
    body?: string;
    resourceType?: string;
    resourceId?: string;
    sendEmail?: boolean;
  }) {
    const [notification] = await db.insert(notifications).values({
      orgId: data.orgId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
    }).returning();

    // Send real-time notification via WebSocket
    sendToUser(data.userId, {
      type: "notification",
      notification: {
        id: notification.id,
        title: data.title,
        body: data.body,
        type: data.type,
      },
    });

    // Send email if requested
    if (data.sendEmail) {
      const email = await getUserEmail(data.userId);
      if (email) {
        const actionUrl = data.resourceType && data.resourceId
          ? `${env.APP_URL}/${data.resourceType}s/${data.resourceId}`
          : undefined;
        const emailContent = buildNotificationEmail(data.title, data.body ?? "", actionUrl);
        await sendEmail({ to: email, ...emailContent });
      }
    }

    return notification;
  },

  async notifyConversationShare(orgId: string, fromUserId: string, toUserId: string, conversationId: string, conversationTitle: string) {
    const prefs = await getUserPrefs(orgId, toUserId);
    return this.create({
      orgId,
      userId: toUserId,
      type: "conversation_shared",
      title: "Conversation shared with you",
      body: `"${conversationTitle}" was shared with you`,
      resourceType: "conversation",
      resourceId: conversationId,
      sendEmail: prefs.emailOnShare,
    });
  },

  async notifyMention(orgId: string, fromUserId: string, toUserId: string, conversationId: string, messageContent: string) {
    const prefs = await getUserPrefs(orgId, toUserId);
    return this.create({
      orgId,
      userId: toUserId,
      type: "mention",
      title: "You were mentioned",
      body: messageContent.slice(0, 200),
      resourceType: "conversation",
      resourceId: conversationId,
      sendEmail: prefs.emailOnMention,
    });
  },

  async notifyAgentComplete(orgId: string, userId: string, agentName: string, conversationId: string) {
    const prefs = await getUserPrefs(orgId, userId);

    // Webhook notification
    if (prefs.webhookOnAgentComplete && prefs.webhookUrl) {
      await sendWebhook(prefs.webhookUrl, {
        event: "agent.complete",
        agent: agentName,
        conversationId,
        orgId,
        timestamp: new Date().toISOString(),
      });
    }

    return this.create({
      orgId,
      userId,
      type: "agent_complete",
      title: `${agentName} finished`,
      body: "Your agent run has completed.",
      resourceType: "conversation",
      resourceId: conversationId,
      sendEmail: prefs.emailOnAgentComplete,
    });
  },

  async notifyBudgetAlert(orgId: string, adminUserId: string, alertName: string, percentage: number) {
    return this.create({
      orgId,
      userId: adminUserId,
      type: "budget_alert",
      title: `Budget Alert: ${alertName}`,
      body: `Spending has reached ${percentage}% of the configured limit.`,
      sendEmail: true,
    });
  },
};
