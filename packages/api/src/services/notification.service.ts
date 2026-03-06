import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { notifications, notificationPreferences } from "@nova/shared/schemas";
import { sendToUser } from "../lib/ws";

export const notificationService = {
  async create(data: {
    orgId: string;
    userId: string;
    type: string;
    title: string;
    body?: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const [notification] = await db.insert(notifications).values({
      orgId: data.orgId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      metadata: data.metadata,
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

    return notification;
  },

  async notifyConversationShare(orgId: string, fromUserId: string, toUserId: string, conversationId: string, conversationTitle: string) {
    return this.create({
      orgId,
      userId: toUserId,
      type: "conversation_shared",
      title: "Conversation shared with you",
      body: `"${conversationTitle}" was shared with you`,
      resourceType: "conversation",
      resourceId: conversationId,
      metadata: { fromUserId },
    });
  },

  async notifyMention(orgId: string, fromUserId: string, toUserId: string, conversationId: string, messageContent: string) {
    return this.create({
      orgId,
      userId: toUserId,
      type: "mention",
      title: "You were mentioned",
      body: messageContent.slice(0, 200),
      resourceType: "conversation",
      resourceId: conversationId,
      metadata: { fromUserId },
    });
  },

  async notifyAgentComplete(orgId: string, userId: string, agentName: string, conversationId: string) {
    return this.create({
      orgId,
      userId,
      type: "agent_complete",
      title: `${agentName} finished`,
      body: "Your agent run has completed.",
      resourceType: "conversation",
      resourceId: conversationId,
    });
  },
};
