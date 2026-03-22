import { sql, lt, eq, and, isNotNull } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { sessions, invitations, files, conversations, messages, auditLogs, orgSettings } from "@nova/shared/schemas";

interface RetentionConfig {
  conversationRetentionDays: number;
  messageRetentionDays: number;
  fileRetentionDays: number;
  auditLogRetentionDays: number;
  deletedDataPurgeDays: number;
  autoArchiveDays: number;
  autoDeleteArchivedDays: number;
}

async function getRetentionConfig(orgId: string): Promise<RetentionConfig> {
  const defaults: RetentionConfig = {
    conversationRetentionDays: 0,
    messageRetentionDays: 0,
    fileRetentionDays: 0,
    auditLogRetentionDays: 365,
    deletedDataPurgeDays: 30,
    autoArchiveDays: 0,
    autoDeleteArchivedDays: 0,
  };

  try {
    const rows = await db.select().from(orgSettings)
      .where(eq(orgSettings.orgId, orgId));

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return {
      conversationRetentionDays: Number(settings["retention.conversations"] ?? 0),
      messageRetentionDays: Number(settings["retention.messages"] ?? 0),
      fileRetentionDays: Number(settings["retention.files"] ?? 0),
      auditLogRetentionDays: Number(settings["retention.audit_logs"] ?? 365),
      deletedDataPurgeDays: Number(settings["retention.deleted_purge"] ?? 30),
      autoArchiveDays: Number(settings["retention.auto_archive"] ?? 0),
      autoDeleteArchivedDays: Number(settings["retention.auto_delete_archived"] ?? 0),
    };
  } catch {
    return defaults;
  }
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning();
  return result.length;
}

export async function cleanupExpiredInvitations(): Promise<number> {
  const result = await db
    .update(invitations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(
      sql`${invitations.acceptedAt} IS NULL`,
      sql`${invitations.deletedAt} IS NULL`,
      lt(invitations.expiresAt, new Date()),
    ))
    .returning();
  return result.length;
}

export async function cleanupOrphanedFiles(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await db
    .delete(files)
    .where(and(
      sql`${files.sizeBytes} = 0`,
      lt(files.createdAt, cutoff),
    ))
    .returning();
  return result.length;
}

export async function cleanupSoftDeletedRecords(): Promise<number> {
  // Get all orgs with retention settings
  const orgs = await db.selectDistinct({ orgId: orgSettings.orgId }).from(orgSettings);
  let totalCleaned = 0;

  for (const { orgId } of orgs) {
    const config = await getRetentionConfig(orgId);
    const purgeDays = config.deletedDataPurgeDays || 30;
    const cutoff = new Date(Date.now() - purgeDays * 24 * 60 * 60 * 1000);

    // Purge soft-deleted conversations
    const convResult = await db
      .delete(conversations)
      .where(and(
        eq(conversations.orgId, orgId),
        isNotNull(conversations.deletedAt),
        lt(conversations.deletedAt, cutoff),
      ))
      .returning();
    totalCleaned += convResult.length;

    // Auto-archive old conversations
    if (config.autoArchiveDays > 0) {
      const archiveCutoff = new Date(Date.now() - config.autoArchiveDays * 24 * 60 * 60 * 1000);
      await db
        .update(conversations)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(and(
          eq(conversations.orgId, orgId),
          eq(conversations.isArchived, false),
          lt(conversations.updatedAt, archiveCutoff),
        ));
    }

    // Auto-delete archived conversations
    if (config.autoDeleteArchivedDays > 0) {
      const deleteArchiveCutoff = new Date(Date.now() - config.autoDeleteArchivedDays * 24 * 60 * 60 * 1000);
      await db
        .update(conversations)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(conversations.orgId, orgId),
          eq(conversations.isArchived, true),
          lt(conversations.updatedAt, deleteArchiveCutoff),
        ));
    }

    // Purge old files by retention policy
    if (config.fileRetentionDays > 0) {
      const fileCutoff = new Date(Date.now() - config.fileRetentionDays * 24 * 60 * 60 * 1000);
      await db
        .update(files)
        .set({ deletedAt: new Date() })
        .where(and(
          eq(files.orgId, orgId),
          lt(files.createdAt, fileCutoff),
        ));
    }

    // Purge old audit logs
    if (config.auditLogRetentionDays > 0) {
      const auditCutoff = new Date(Date.now() - config.auditLogRetentionDays * 24 * 60 * 60 * 1000);
      const auditResult = await db
        .delete(auditLogs)
        .where(and(
          eq(auditLogs.orgId, orgId),
          lt(auditLogs.createdAt, auditCutoff),
        ))
        .returning();
      totalCleaned += auditResult.length;
    }
  }

  return totalCleaned;
}
