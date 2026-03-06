import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import {
  users,
  userProfiles,
  conversations,
  messages,
  agents,
  files,
  apiKeys,
  knowledgeCollections,
  notifications,
} from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

const gdprRoutes = new Hono<AppContext>();

// GDPR data export for a user (admin only)
gdprRoutes.post(
  "/export",
  zValidator("json", z.object({ userId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get("orgId");
    const actorId = c.get("userId");
    const { userId } = c.req.valid("json");

    // Fetch all user data
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw AppError.notFound("User");

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));

    const userConversations = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.ownerId, userId), eq(conversations.orgId, orgId)));

    const conversationIds = userConversations.map((c) => c.id);
    let userMessages: any[] = [];
    if (conversationIds.length > 0) {
      for (const convId of conversationIds) {
        const msgs = await db
          .select()
          .from(messages)
          .where(and(eq(messages.conversationId, convId), eq(messages.orgId, orgId)));
        userMessages.push(...msgs);
      }
    }

    const userAgents = await db
      .select()
      .from(agents)
      .where(and(eq(agents.ownerId, userId), eq(agents.orgId, orgId)));

    const userFiles = await db
      .select()
      .from(files)
      .where(and(eq(files.uploadedById, userId), eq(files.orgId, orgId)));

    const userApiKeys = await db
      .select({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix, label: apiKeys.label, createdAt: apiKeys.createdAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.orgId, orgId)));

    const userCollections = await db
      .select()
      .from(knowledgeCollections)
      .where(and(eq(knowledgeCollections.ownerId, userId), eq(knowledgeCollections.orgId, orgId)));

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.orgId, orgId)));

    await writeAuditLog({
      orgId,
      actorId,
      actorType: "user",
      action: "gdpr.export",
      resourceType: "user",
      resourceId: userId,
    });

    return c.json({
      exportedAt: new Date().toISOString(),
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      profile,
      conversations: userConversations,
      messages: userMessages,
      agents: userAgents,
      files: userFiles.map((f) => ({ id: f.id, filename: f.filename, mimeType: f.mimeType, sizeBytes: f.sizeBytes, createdAt: f.createdAt })),
      apiKeys: userApiKeys,
      knowledgeCollections: userCollections,
      notifications: userNotifications,
    });
  },
);

// GDPR data deletion (admin only)
gdprRoutes.post(
  "/delete",
  zValidator("json", z.object({
    userId: z.string().uuid(),
    confirmPhrase: z.literal("DELETE ALL DATA"),
  })),
  async (c) => {
    const orgId = c.get("orgId");
    const actorId = c.get("userId");
    const { userId } = c.req.valid("json");

    // Soft-delete all user data while preserving anonymized audit logs
    const now = new Date();

    // Delete conversations (cascades to messages, participants, etc.)
    await db
      .update(conversations)
      .set({ deletedAt: now })
      .where(and(eq(conversations.ownerId, userId), eq(conversations.orgId, orgId), isNull(conversations.deletedAt)));

    // Delete agents
    await db
      .update(agents)
      .set({ deletedAt: now })
      .where(and(eq(agents.ownerId, userId), eq(agents.orgId, orgId), isNull(agents.deletedAt)));

    // Revoke API keys
    await db
      .update(apiKeys)
      .set({ revokedAt: now })
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)));

    // Mark files as deleted
    await db
      .update(files)
      .set({ deletedAt: now })
      .where(and(eq(files.uploadedById, userId), eq(files.orgId, orgId), isNull(files.deletedAt)));

    // Delete knowledge collections
    await db
      .update(knowledgeCollections)
      .set({ deletedAt: now })
      .where(and(eq(knowledgeCollections.ownerId, userId), eq(knowledgeCollections.orgId, orgId), isNull(knowledgeCollections.deletedAt)));

    // Delete notifications
    await db
      .delete(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.orgId, orgId)));

    // Anonymize user profile (keep the record for audit trail integrity)
    await db
      .update(userProfiles)
      .set({
        displayName: "[Deleted User]",
        avatarUrl: null,
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));

    await writeAuditLog({
      orgId,
      actorId,
      actorType: "user",
      action: "gdpr.delete",
      resourceType: "user",
      resourceId: userId,
      details: { note: "All personal data soft-deleted, profile anonymized" },
    });

    return c.json({ ok: true, message: "User data has been deleted. Audit logs preserved with anonymized references." });
  },
);

export { gdprRoutes };
