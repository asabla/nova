import { db } from "../lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { notifications, notificationPreferences, users } from "@nova/shared/schemas";
import { sendToUser } from "../lib/ws";
import { sendEmail, buildNotificationEmail } from "../lib/email";
import { env } from "../lib/env";

interface NotificationPrefs {
  emailOnShare: boolean;
  emailOnMention: boolean;
  emailOnAgentComplete: boolean;
  inAppEnabled: boolean;
  webhookOnAgentComplete?: boolean;
  webhookUrl?: string;
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailOnShare: true,
  emailOnMention: true,
  emailOnAgentComplete: false,
  inAppEnabled: true,
};

/**
 * Maps our fine-grained preference keys to (notificationType, channel) pairs
 * stored in the notificationPreferences table.
 */
const PREF_MAPPING: Record<keyof Omit<NotificationPrefs, "webhookOnAgentComplete" | "webhookUrl">, { notificationType: string; channel: string }> = {
  emailOnShare: { notificationType: "conversation_shared", channel: "email" },
  emailOnMention: { notificationType: "mention", channel: "email" },
  emailOnAgentComplete: { notificationType: "agent_complete", channel: "email" },
  inAppEnabled: { notificationType: "all", channel: "in_app" },
};

async function getUserPrefs(orgId: string, userId: string): Promise<NotificationPrefs> {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.orgId, orgId),
        isNull(notificationPreferences.deletedAt),
      ),
    );

  // Start from defaults, then overlay any stored preferences
  const prefs: NotificationPrefs = { ...DEFAULT_PREFS };

  for (const row of rows) {
    for (const [key, mapping] of Object.entries(PREF_MAPPING)) {
      if (row.notificationType === mapping.notificationType && row.channel === mapping.channel) {
        (prefs as any)[key] = row.isEnabled;
      }
    }
    // Webhook preferences
    if (row.notificationType === "agent_complete" && row.channel === "webhook") {
      prefs.webhookOnAgentComplete = row.isEnabled;
    }
  }

  return prefs;
}

/**
 * Upsert a single notification preference for a user.
 */
export async function upsertPreference(
  orgId: string,
  userId: string,
  notificationType: string,
  channel: string,
  isEnabled: boolean,
) {
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.orgId, orgId),
        eq(notificationPreferences.notificationType, notificationType),
        eq(notificationPreferences.channel, channel),
      ),
    );

  if (existing.length > 0) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({ isEnabled, updatedAt: new Date(), deletedAt: null })
      .where(eq(notificationPreferences.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(notificationPreferences)
    .values({ userId, orgId, notificationType, channel, isEnabled })
    .returning();
  return created;
}

/**
 * Return the current user's structured preferences, suitable for the frontend.
 */
export async function getStructuredPrefs(orgId: string, userId: string) {
  const prefs = await getUserPrefs(orgId, userId);
  return prefs;
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
    /** When false, skip in-app notification persistence and WebSocket push. Defaults to true. */
    sendInApp?: boolean;
  }) {
    const shouldSendInApp = data.sendInApp !== false;

    let notification: typeof notifications.$inferSelect | null = null;

    // Persist in-app notification and push via WebSocket
    if (shouldSendInApp) {
      const [created] = await db.insert(notifications).values({
        orgId: data.orgId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
      }).returning();
      notification = created;

      sendToUser(data.userId, {
        type: "notification",
        notification: {
          id: notification.id,
          title: data.title,
          body: data.body,
          type: data.type,
        },
      });
    }

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
    // Don't notify yourself
    if (fromUserId === toUserId) return null;

    const prefs = await getUserPrefs(orgId, toUserId);
    return this.create({
      orgId,
      userId: toUserId,
      type: "conversation_shared",
      title: "Conversation shared with you",
      body: `"${conversationTitle}" was shared with you`,
      resourceType: "conversation",
      resourceId: conversationId,
      sendInApp: prefs.inAppEnabled,
      sendEmail: prefs.emailOnShare,
    });
  },

  async notifyMention(orgId: string, fromUserId: string, toUserId: string, conversationId: string, messageContent: string) {
    // Don't notify yourself
    if (fromUserId === toUserId) return null;

    const prefs = await getUserPrefs(orgId, toUserId);
    return this.create({
      orgId,
      userId: toUserId,
      type: "mention",
      title: "You were mentioned",
      body: messageContent.slice(0, 200),
      resourceType: "conversation",
      resourceId: conversationId,
      sendInApp: prefs.inAppEnabled,
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
      sendInApp: prefs.inAppEnabled,
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
