import { db } from "../lib/db";
import { messages, messageAttachments, messageRatings, messageNotes, conversations } from "@nova/shared/schema";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import type { InsertMessage } from "@nova/shared/schema";
import { parsePagination, buildPaginatedResponse, type PaginationInput } from "@nova/shared/utils";

export async function listMessages(orgId: string, conversationId: string, pagination: PaginationInput) {
  const { offset, limit, page, pageSize } = parsePagination(pagination);

  const where = and(
    eq(messages.conversationId, conversationId),
    eq(messages.orgId, orgId),
    isNull(messages.deletedAt),
  );

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(where)
      .orderBy(asc(messages.createdAt))
      .offset(offset)
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(where),
  ]);

  return buildPaginatedResponse(data, countResult[0]?.count ?? 0, { offset, limit, page, pageSize });
}

export async function getMessage(orgId: string, messageId: string) {
  const result = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.orgId, orgId), isNull(messages.deletedAt)));
  return result[0] ?? null;
}

export async function createMessage(orgId: string, data: InsertMessage) {
  const result = await db.insert(messages).values({
    ...data,
    orgId,
  }).returning();

  const message = result[0];

  if (data.tokenCountPrompt || data.tokenCountCompletion) {
    const totalNew = (data.tokenCountPrompt ?? 0) + (data.tokenCountCompletion ?? 0);
    await db
      .update(conversations)
      .set({
        totalTokens: sql`${conversations.totalTokens} + ${totalNew}`,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, data.conversationId));
  }

  return message;
}

export async function editMessage(orgId: string, messageId: string, newContent: string) {
  const existing = await getMessage(orgId, messageId);
  if (!existing) return null;

  const history = (existing.editHistory as any[]) ?? [];
  history.push({ content: existing.content, editedAt: new Date().toISOString() });

  const result = await db
    .update(messages)
    .set({
      content: newContent,
      isEdited: true,
      editHistory: history,
      updatedAt: new Date(),
    })
    .where(and(eq(messages.id, messageId), eq(messages.orgId, orgId)))
    .returning();

  return result[0] ?? null;
}

export async function deleteMessage(orgId: string, messageId: string) {
  const result = await db
    .update(messages)
    .set({ deletedAt: new Date() })
    .where(and(eq(messages.id, messageId), eq(messages.orgId, orgId), isNull(messages.deletedAt)))
    .returning();
  return result[0] ?? null;
}

export async function rateMessage(orgId: string, messageId: string, userId: string, rating: 1 | -1, feedback?: string) {
  const existing = await db
    .select()
    .from(messageRatings)
    .where(and(eq(messageRatings.messageId, messageId), eq(messageRatings.userId, userId)));

  if (existing.length > 0) {
    const result = await db
      .update(messageRatings)
      .set({ rating, feedback, updatedAt: new Date() })
      .where(eq(messageRatings.id, existing[0].id))
      .returning();
    return result[0];
  }

  const result = await db.insert(messageRatings).values({
    messageId,
    userId,
    orgId,
    rating,
    feedback,
  }).returning();
  return result[0];
}

export async function addNote(orgId: string, messageId: string, userId: string, content: string) {
  const result = await db.insert(messageNotes).values({
    messageId,
    userId,
    orgId,
    content,
  }).returning();
  return result[0];
}

export async function getAttachments(orgId: string, messageId: string) {
  return db
    .select()
    .from(messageAttachments)
    .where(and(eq(messageAttachments.messageId, messageId), eq(messageAttachments.orgId, orgId), isNull(messageAttachments.deletedAt)));
}

export async function addAttachment(orgId: string, messageId: string, data: {
  fileId?: string;
  url?: string;
  urlTitle?: string;
  attachmentType: string;
}) {
  const result = await db.insert(messageAttachments).values({
    messageId,
    orgId,
    ...data,
  }).returning();
  return result[0];
}
