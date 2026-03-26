import { sql, lt, eq, and, isNotNull, inArray } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { sessions, invitations, files, conversations, auditLogs, orgSettings } from "@nova/shared/schemas";

const BATCH_SIZE = 5000;

interface RetentionConfig {
  conversationRetentionDays: number;
  messageRetentionDays: number;
  fileRetentionDays: number;
  auditLogRetentionDays: number;
  deletedDataPurgeDays: number;
  autoArchiveDays: number;
  autoDeleteArchivedDays: number;
}

const RETENTION_DEFAULTS: RetentionConfig = {
  conversationRetentionDays: 0,
  messageRetentionDays: 0,
  fileRetentionDays: 0,
  auditLogRetentionDays: 365,
  deletedDataPurgeDays: 30,
  autoArchiveDays: 0,
  autoDeleteArchivedDays: 0,
};

const SETTING_KEY_MAP: Record<string, keyof RetentionConfig> = {
  "retention.conversations": "conversationRetentionDays",
  "retention.messages": "messageRetentionDays",
  "retention.files": "fileRetentionDays",
  "retention.audit_logs": "auditLogRetentionDays",
  "retention.deleted_purge": "deletedDataPurgeDays",
  "retention.auto_archive": "autoArchiveDays",
  "retention.auto_delete_archived": "autoDeleteArchivedDays",
};

async function getAllRetentionConfigs(): Promise<Map<string, RetentionConfig>> {
  const rows = await db.select().from(orgSettings);

  const configs = new Map<string, RetentionConfig>();
  for (const row of rows) {
    if (!configs.has(row.orgId)) {
      configs.set(row.orgId, { ...RETENTION_DEFAULTS });
    }
    const configKey = SETTING_KEY_MAP[row.key];
    if (configKey) {
      configs.get(row.orgId)![configKey] = Number(row.value) || 0;
    }
  }

  return configs;
}

async function batchDelete(
  table: typeof sessions | typeof auditLogs,
  idColumn: typeof sessions.id | typeof auditLogs.id,
  condition: ReturnType<typeof and>,
): Promise<number> {
  let total = 0;
  while (true) {
    const result = await db.execute(
      sql`WITH to_delete AS (
        SELECT ${idColumn} FROM ${table} WHERE ${condition} LIMIT ${BATCH_SIZE}
      )
      DELETE FROM ${table} WHERE ${idColumn} IN (SELECT ${idColumn} FROM to_delete)
      RETURNING 1`
    );
    const count = (result as unknown as unknown[]).length;
    total += count;
    if (count < BATCH_SIZE) break;
  }
  return total;
}

export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();
  return batchDelete(sessions, sessions.id, lt(sessions.expiresAt, now));
}

export async function cleanupExpiredInvitations(): Promise<number> {
  const now = new Date();
  let total = 0;
  while (true) {
    const ids = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(
        sql`${invitations.acceptedAt} IS NULL`,
        sql`${invitations.deletedAt} IS NULL`,
        lt(invitations.expiresAt, now),
      ))
      .limit(BATCH_SIZE);

    if (ids.length === 0) break;

    await db
      .update(invitations)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(invitations.id, ids.map(r => r.id)));

    total += ids.length;
    if (ids.length < BATCH_SIZE) break;
  }
  return total;
}

export async function cleanupOrphanedFiles(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let total = 0;
  while (true) {
    const ids = await db
      .select({ id: files.id })
      .from(files)
      .where(and(
        sql`${files.sizeBytes} = 0`,
        lt(files.createdAt, cutoff),
      ))
      .limit(BATCH_SIZE);

    if (ids.length === 0) break;

    await db.delete(files).where(inArray(files.id, ids.map(r => r.id)));

    total += ids.length;
    if (ids.length < BATCH_SIZE) break;
  }
  return total;
}

export async function cleanupSoftDeletedRecords(): Promise<number> {
  const configs = await getAllRetentionConfigs();
  let totalCleaned = 0;

  // Process orgs in parallel batches of 10
  const orgIds = Array.from(configs.keys());
  for (let i = 0; i < orgIds.length; i += 10) {
    const batch = orgIds.slice(i, i + 10);
    const results = await Promise.all(batch.map(orgId => cleanupOrg(orgId, configs.get(orgId)!)));
    totalCleaned += results.reduce((sum, n) => sum + n, 0);
  }

  return totalCleaned;
}

async function cleanupOrg(orgId: string, config: RetentionConfig): Promise<number> {
  let cleaned = 0;
  const now = new Date();

  // Purge soft-deleted conversations (batched due to CASCADE to messages)
  const purgeDays = config.deletedDataPurgeDays || 30;
  const purgeCutoff = new Date(Date.now() - purgeDays * 24 * 60 * 60 * 1000);

  let purging = true;
  while (purging) {
    const ids = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(
        eq(conversations.orgId, orgId),
        isNotNull(conversations.deletedAt),
        lt(conversations.deletedAt, purgeCutoff),
      ))
      .limit(500); // Smaller batch for cascading deletes

    if (ids.length === 0) break;

    await db.delete(conversations).where(inArray(conversations.id, ids.map(r => r.id)));
    cleaned += ids.length;
    if (ids.length < 500) purging = false;
  }

  // Auto-archive old conversations
  if (config.autoArchiveDays > 0) {
    const archiveCutoff = new Date(Date.now() - config.autoArchiveDays * 24 * 60 * 60 * 1000);
    await db
      .update(conversations)
      .set({ isArchived: true, updatedAt: now })
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
      .set({ deletedAt: now, updatedAt: now })
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
      .set({ deletedAt: now })
      .where(and(
        eq(files.orgId, orgId),
        lt(files.createdAt, fileCutoff),
      ));
  }

  // Purge old audit logs (batched)
  if (config.auditLogRetentionDays > 0) {
    const auditCutoff = new Date(Date.now() - config.auditLogRetentionDays * 24 * 60 * 60 * 1000);
    cleaned += await batchDelete(
      auditLogs,
      auditLogs.id,
      and(eq(auditLogs.orgId, orgId), lt(auditLogs.createdAt, auditCutoff)),
    );
  }

  return cleaned;
}
