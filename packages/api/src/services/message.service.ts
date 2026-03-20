import { db } from "../lib/db";
import { messages, messageAttachments, messageRatings, messageNotes, conversations, files } from "@nova/shared/schemas";
import { eq, and, isNull, asc, sql, inArray } from "drizzle-orm";
import { parsePagination, buildPaginatedResponse, type PaginationInput } from "@nova/shared/utils";
import { syncMessageUpsert, syncMessageDelete } from "../lib/qdrant-sync";
import { getTemporalClient } from "../lib/temporal";

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

  // Fetch attachments with file info for all messages in one query
  const messageIds = data.map((m) => m.id);
  let attachmentsByMessage: Record<string, any[]> = {};
  if (messageIds.length > 0) {
    const allAttachments = await db
      .select({
        id: messageAttachments.id,
        messageId: messageAttachments.messageId,
        fileId: messageAttachments.fileId,
        url: messageAttachments.url,
        attachmentType: messageAttachments.attachmentType,
        filename: files.filename,
        contentType: files.contentType,
        sizeBytes: files.sizeBytes,
      })
      .from(messageAttachments)
      .leftJoin(files, eq(messageAttachments.fileId, files.id))
      .where(and(
        inArray(messageAttachments.messageId, messageIds),
        isNull(messageAttachments.deletedAt),
      ));

    for (const a of allAttachments) {
      (attachmentsByMessage[a.messageId] ??= []).push(a);
    }
  }

  const enriched = data.map((m) => ({
    ...m,
    attachments: attachmentsByMessage[m.id] ?? [],
  }));

  return buildPaginatedResponse(enriched, countResult[0]?.count ?? 0, { offset, limit, page, pageSize });
}

export async function getMessage(orgId: string, messageId: string) {
  const result = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.orgId, orgId), isNull(messages.deletedAt)));
  return result[0] ?? null;
}

export async function createMessage(orgId: string, data: {
  conversationId: string;
  senderType: string;
  content?: string;
  senderUserId?: string;
  agentId?: string;
  modelId?: string;
  contentType?: string;
  metadata?: unknown;
  tokenCountPrompt?: number;
  tokenCountCompletion?: number;
  costCents?: number;
}) {
  const result = await db.insert(messages).values({
    orgId,
    conversationId: data.conversationId,
    senderType: data.senderType,
    content: data.content,
    senderUserId: data.senderUserId,
    agentId: data.agentId,
    modelId: data.modelId,
    contentType: data.contentType ?? "text",
    metadata: data.metadata,
    tokenCountPrompt: data.tokenCountPrompt,
    tokenCountCompletion: data.tokenCountCompletion,
    costCents: data.costCents,
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

  // Sync to Qdrant (payload only, no vector yet)
  syncMessageUpsert(message as any);

  // Trigger async embedding workflow for non-empty user/assistant messages
  if (message.content && (message.senderType === "user" || message.senderType === "assistant")) {
    getTemporalClient()
      .then((client) =>
        client.workflow.start("messageEmbeddingWorkflow", {
          taskQueue: "nova-main",
          workflowId: `msg-embed-${message.id}`,
          args: [{ messageId: message.id, orgId }],
        }),
      )
      .catch((err) => console.error("[message] Failed to start embedding workflow:", err));
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
  if (result[0]) syncMessageDelete(messageId);
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
