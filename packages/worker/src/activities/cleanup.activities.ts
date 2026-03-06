import { sql, lt, eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { sessions, invitations, files, conversations } from "@nova/shared/schemas";

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
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(
      eq(invitations.status, "pending"),
      lt(invitations.expiresAt, new Date()),
    ))
    .returning();
  return result.length;
}

export async function cleanupOrphanedFiles(): Promise<number> {
  // Files that are in "pending" status for over 24 hours (upload never confirmed)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await db
    .delete(files)
    .where(and(
      eq(files.status, "pending"),
      lt(files.createdAt, cutoff),
    ))
    .returning();
  return result.length;
}

export async function cleanupSoftDeletedRecords(): Promise<number> {
  // Permanently remove records soft-deleted more than 30 days ago
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(conversations)
    .where(and(
      eq(conversations.isDeleted, true),
      lt(conversations.deletedAt, cutoff),
    ))
    .returning();
  return result.length;
}
