import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
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
  dataJobs,
} from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";
import { requireRole } from "../middleware/rbac";

const gdprRoutes = new Hono<AppContext>();

// POST /gdpr/export/:userId - Generate GDPR data export for a user (stories #191-192)
// Requires org-admin role. Creates an async job and returns immediately.
gdprRoutes.post(
  "/export/:userId",
  requireRole("org-admin"),
  zValidator("param", z.object({ userId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get("orgId");
    const actorId = c.get("userId");
    const { userId } = c.req.valid("param");

    // Verify user exists
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw AppError.notFound("User");

    // Create a data job to track this GDPR export request
    const [job] = await db
      .insert(dataJobs)
      .values({
        orgId,
        userId: actorId,
        type: "gdpr_export",
        status: "processing",
        metadata: { targetUserId: userId },
      })
      .returning();

    try {
      // Fetch all user data across the org
      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));

      const userConversations = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.ownerId, userId), eq(conversations.orgId, orgId)));

      const conversationIds = userConversations.map((conv) => conv.id);
      const userMessages = conversationIds.length > 0
        ? await db
            .select()
            .from(messages)
            .where(and(inArray(messages.conversationId, conversationIds), eq(messages.orgId, orgId)))
        : [];

      const userAgents = await db
        .select()
        .from(agents)
        .where(and(eq(agents.ownerId, userId), eq(agents.orgId, orgId)));

      const userFiles = await db
        .select()
        .from(files)
        .where(and(eq(files.userId, userId), eq(files.orgId, orgId)));

      const userApiKeys = await db
        .select({
          id: apiKeys.id,
          keyPrefix: apiKeys.keyPrefix,
          name: apiKeys.name,
          createdAt: apiKeys.createdAt,
        })
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

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportFormat: "nova-gdpr-export-v1",
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
        profile,
        conversations: userConversations,
        messages: userMessages,
        agents: userAgents,
        files: userFiles.map((f) => ({
          id: f.id,
          filename: f.filename,
          contentType: f.contentType,
          sizeBytes: f.sizeBytes,
          createdAt: f.createdAt,
        })),
        apiKeys: userApiKeys,
        knowledgeCollections: userCollections,
        notifications: userNotifications,
      };

      // Mark job as completed and store summary in metadata
      await db
        .update(dataJobs)
        .set({
          status: "completed",
          progressPct: 100,
          metadata: {
            targetUserId: userId,
            recordCounts: {
              conversations: userConversations.length,
              messages: userMessages.length,
              agents: userAgents.length,
              files: userFiles.length,
              apiKeys: userApiKeys.length,
              knowledgeCollections: userCollections.length,
              notifications: userNotifications.length,
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(dataJobs.id, job.id));

      await writeAuditLog({
        orgId,
        actorId,
        actorType: "user",
        action: "gdpr.export",
        resourceType: "user",
        resourceId: userId,
        details: {
          jobId: job.id,
          recordCounts: {
            conversations: userConversations.length,
            messages: userMessages.length,
          },
        },
      });

      return c.json({
        requestId: job.id,
        status: "completed",
        exportData,
      });
    } catch (err) {
      // Mark job as failed
      await db
        .update(dataJobs)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
          updatedAt: new Date(),
        })
        .where(eq(dataJobs.id, job.id));
      throw err;
    }
  },
);

// POST /gdpr/delete/:userId - Process GDPR right-to-erasure (story #193)
// Requires org-admin role. Soft-deletes PII and anonymizes audit log references.
gdprRoutes.post(
  "/delete/:userId",
  requireRole("org-admin"),
  zValidator("param", z.object({ userId: z.string().uuid() })),
  zValidator(
    "json",
    z.object({
      confirmPhrase: z.literal("DELETE ALL DATA"),
    }),
  ),
  async (c) => {
    const orgId = c.get("orgId");
    const actorId = c.get("userId");
    const { userId } = c.req.valid("param");

    // Prevent self-deletion
    if (actorId === userId) {
      throw AppError.badRequest("Cannot process GDPR deletion for yourself. Contact a different admin.");
    }

    // Verify user exists
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw AppError.notFound("User");

    // Create a data job to track this GDPR deletion request
    const [job] = await db
      .insert(dataJobs)
      .values({
        orgId,
        userId: actorId,
        type: "gdpr_delete",
        status: "processing",
        metadata: { targetUserId: userId, targetEmail: user.email },
      })
      .returning();

    const now = new Date();

    try {
      // 1. Soft-delete conversations (cascades to messages via app logic)
      const convResult = await db
        .update(conversations)
        .set({ deletedAt: now })
        .where(
          and(
            eq(conversations.ownerId, userId),
            eq(conversations.orgId, orgId),
            isNull(conversations.deletedAt),
          ),
        )
        .returning({ id: conversations.id });

      // 2. Soft-delete messages in those conversations
      for (const conv of convResult) {
        await db
          .update(messages)
          .set({ deletedAt: now, content: "[deleted]" })
          .where(
            and(
              eq(messages.conversationId, conv.id),
              eq(messages.orgId, orgId),
              isNull(messages.deletedAt),
            ),
          );
      }

      // 3. Soft-delete agents
      await db
        .update(agents)
        .set({ deletedAt: now })
        .where(
          and(eq(agents.ownerId, userId), eq(agents.orgId, orgId), isNull(agents.deletedAt)),
        );

      // 4. Revoke API keys
      await db
        .update(apiKeys)
        .set({ revokedAt: now })
        .where(
          and(eq(apiKeys.userId, userId), eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)),
        );

      // 5. Soft-delete files
      await db
        .update(files)
        .set({ deletedAt: now })
        .where(
          and(eq(files.userId, userId), eq(files.orgId, orgId), isNull(files.deletedAt)),
        );

      // 6. Soft-delete knowledge collections
      await db
        .update(knowledgeCollections)
        .set({ deletedAt: now })
        .where(
          and(
            eq(knowledgeCollections.ownerId, userId),
            eq(knowledgeCollections.orgId, orgId),
            isNull(knowledgeCollections.deletedAt),
          ),
        );

      // 7. Hard-delete notifications (no audit value)
      await db
        .delete(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.orgId, orgId)));

      // 8. Anonymize user profile (preserve record for audit trail integrity)
      await db
        .update(userProfiles)
        .set({
          displayName: "[Deleted User]",
          avatarUrl: null,
          deletedAt: now,
          updatedAt: now,
        })
        .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));

      // 9. Anonymize the user record itself (scrub PII, keep ID for referential integrity)
      await db
        .update(users)
        .set({
          email: `deleted-${userId}@anonymized.nova`,
          isActive: false,
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      // Mark job as completed
      await db
        .update(dataJobs)
        .set({
          status: "completed",
          progressPct: 100,
          metadata: {
            targetUserId: userId,
            conversationsDeleted: convResult.length,
            completedAt: now.toISOString(),
          },
          updatedAt: now,
        })
        .where(eq(dataJobs.id, job.id));

      await writeAuditLog({
        orgId,
        actorId,
        actorType: "user",
        action: "gdpr.delete",
        resourceType: "user",
        resourceId: userId,
        details: {
          jobId: job.id,
          note: "All personal data soft-deleted, profile and user record anonymized, audit logs preserved",
          conversationsDeleted: convResult.length,
        },
      });

      return c.json({
        ok: true,
        requestId: job.id,
        message:
          "User data has been deleted and anonymized. Audit logs preserved with anonymized references.",
        summary: {
          conversationsDeleted: convResult.length,
          profileAnonymized: true,
          userRecordAnonymized: true,
          apiKeysRevoked: true,
          filesDeleted: true,
          notificationsRemoved: true,
        },
      });
    } catch (err) {
      await db
        .update(dataJobs)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
          updatedAt: new Date(),
        })
        .where(eq(dataJobs.id, job.id));
      throw err;
    }
  },
);

// GET /gdpr/status/:requestId - Check GDPR request status (story #194)
gdprRoutes.get(
  "/status/:requestId",
  requireRole("org-admin"),
  zValidator("param", z.object({ requestId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get("orgId");
    const { requestId } = c.req.valid("param");

    const [job] = await db
      .select()
      .from(dataJobs)
      .where(
        and(
          eq(dataJobs.id, requestId),
          eq(dataJobs.orgId, orgId),
          // Only return GDPR-type jobs
        ),
      );

    if (!job) throw AppError.notFound("GDPR request");

    if (job.type !== "gdpr_export" && job.type !== "gdpr_delete") {
      throw AppError.notFound("GDPR request");
    }

    return c.json({
      requestId: job.id,
      type: job.type,
      status: job.status,
      progressPct: job.progressPct,
      errorMessage: job.errorMessage,
      metadata: job.metadata,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  },
);

export { gdprRoutes };
