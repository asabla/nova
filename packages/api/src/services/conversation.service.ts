import { db } from "../lib/db";
import { conversations, conversationParticipants } from "@nova/shared/schemas";
import { eq, and, isNull, desc, ilike, sql, inArray } from "drizzle-orm";
import type { Conversation } from "@nova/shared/schemas";
import { parsePagination, buildPaginatedResponse, type PaginationInput } from "@nova/shared/utils";
import { AppError } from "@nova/shared/utils";

type UpdateConversationData = Partial<{
  title: string;
  systemPrompt: string;
  modelId: string;
  modelParams: unknown;
  visibility: string;
  isPinned: boolean;
  isArchived: boolean;
  workspaceId: string;
  forkedFromMessageId: string;
  publicShareToken: string;
}>;

export async function listConversations(
  orgId: string,
  userId: string,
  pagination: PaginationInput,
  filters?: { search?: string; workspaceId?: string; isArchived?: boolean; isPinned?: boolean },
) {
  const { offset, limit, page, pageSize } = parsePagination(pagination);

  const conditions = [
    eq(conversations.orgId, orgId),
    eq(conversations.ownerId, userId),
    isNull(conversations.deletedAt),
  ];

  if (filters?.search) {
    conditions.push(ilike(conversations.title, `%${filters.search}%`));
  }
  if (filters?.workspaceId) {
    conditions.push(eq(conversations.workspaceId, filters.workspaceId));
  }
  if (filters?.isArchived !== undefined) {
    conditions.push(eq(conversations.isArchived, filters.isArchived));
  }
  if (filters?.isPinned !== undefined) {
    conditions.push(eq(conversations.isPinned, filters.isPinned));
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(conversations)
      .where(where)
      .orderBy(desc(conversations.isPinned), desc(conversations.updatedAt))
      .offset(offset)
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(where),
  ]);

  return buildPaginatedResponse(data, countResult[0]?.count ?? 0, { offset, limit, page, pageSize });
}

export async function getConversation(orgId: string, conversationId: string) {
  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId), isNull(conversations.deletedAt)));
  return result[0] ?? null;
}

export async function getConversationByShareToken(shareToken: string) {
  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.publicShareToken, shareToken), isNull(conversations.deletedAt)));
  return result[0] ?? null;
}

export async function createConversation(orgId: string, userId: string, data: {
  title?: string;
  systemPrompt?: string;
  modelId?: string;
  modelParams?: unknown;
  visibility?: string;
  workspaceId?: string;
  forkedFromMessageId?: string;
}) {
  const result = await db.insert(conversations).values({
    orgId,
    ownerId: userId,
    title: data.title,
    systemPrompt: data.systemPrompt,
    modelId: data.modelId,
    modelParams: data.modelParams,
    visibility: data.visibility ?? "private",
    workspaceId: data.workspaceId,
    forkedFromMessageId: data.forkedFromMessageId,
  }).returning();

  const conversation = result[0];

  await db.insert(conversationParticipants).values({
    conversationId: conversation.id,
    userId,
    orgId,
    role: "owner",
  });

  return conversation;
}

export async function updateConversation(orgId: string, conversationId: string, data: UpdateConversationData) {
  const result = await db
    .update(conversations)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId), isNull(conversations.deletedAt)))
    .returning();
  return result[0] ?? null;
}

export async function archiveConversation(orgId: string, conversationId: string) {
  return updateConversation(orgId, conversationId, { isArchived: true });
}

export async function deleteConversation(orgId: string, conversationId: string) {
  const result = await db
    .update(conversations)
    .set({ deletedAt: new Date() })
    .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId), isNull(conversations.deletedAt)))
    .returning();
  return result[0] ?? null;
}

export async function pinConversation(orgId: string, conversationId: string, isPinned: boolean) {
  return updateConversation(orgId, conversationId, { isPinned });
}

export async function forkConversation(orgId: string, userId: string, conversationId: string, messageId: string) {
  const original = await getConversation(orgId, conversationId);
  if (!original) return null;

  return createConversation(orgId, userId, {
    title: original.title ? `Fork of ${original.title}` : "Forked conversation",
    systemPrompt: original.systemPrompt ?? undefined,
    modelId: original.modelId ?? undefined,
    modelParams: original.modelParams,
    workspaceId: original.workspaceId ?? undefined,
    forkedFromMessageId: messageId,
  });
}

export async function generateShareToken(orgId: string, conversationId: string) {
  const token = crypto.randomUUID().replace(/-/g, "");
  const result = await db
    .update(conversations)
    .set({ publicShareToken: token, visibility: "public" })
    .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)))
    .returning();
  return result[0] ?? null;
}

export async function updateModelParams(
  orgId: string,
  conversationId: string,
  params: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  },
) {
  const existing = await getConversation(orgId, conversationId);
  if (!existing) return null;

  const currentParams = (existing.modelParams as Record<string, unknown>) ?? {};
  const merged = { ...currentParams, ...params };

  return updateConversation(orgId, conversationId, { modelParams: merged });
}

export async function addParticipant(orgId: string, conversationId: string, userId: string) {
  const conversation = await getConversation(orgId, conversationId);
  if (!conversation) return null;

  // Check if participant already exists (including soft-deleted)
  const existingResult = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    );

  const existing = existingResult[0];

  if (existing) {
    if (existing.deletedAt) {
      // Re-activate soft-deleted participant
      const result = await db
        .update(conversationParticipants)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(conversationParticipants.id, existing.id))
        .returning();
      return result[0];
    }
    throw AppError.conflict("User is already a participant in this conversation");
  }

  const result = await db
    .insert(conversationParticipants)
    .values({
      conversationId,
      userId,
      orgId,
      role: "participant",
    })
    .returning();

  return result[0];
}

export async function removeParticipant(orgId: string, conversationId: string, userId: string) {
  const result = await db
    .update(conversationParticipants)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
        eq(conversationParticipants.orgId, orgId),
        isNull(conversationParticipants.deletedAt),
      ),
    )
    .returning();

  return result[0] ?? null;
}

export async function listParticipants(orgId: string, conversationId: string) {
  return db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.orgId, orgId),
        isNull(conversationParticipants.deletedAt),
      ),
    );
}

export async function bulkAction(
  orgId: string,
  userId: string,
  ids: string[],
  action: "archive" | "delete" | "move-to-folder",
  payload?: { folderId?: string },
) {
  if (ids.length === 0) {
    throw AppError.badRequest("No conversation IDs provided");
  }

  const baseConditions = and(
    inArray(conversations.id, ids),
    eq(conversations.orgId, orgId),
    eq(conversations.ownerId, userId),
    isNull(conversations.deletedAt),
  );

  switch (action) {
    case "archive": {
      const result = await db
        .update(conversations)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(baseConditions)
        .returning();
      return { affected: result.length, action };
    }
    case "delete": {
      const result = await db
        .update(conversations)
        .set({ deletedAt: new Date() })
        .where(baseConditions)
        .returning();
      return { affected: result.length, action };
    }
    case "move-to-folder": {
      if (!payload?.folderId) {
        throw AppError.badRequest("folderId is required for move-to-folder action");
      }
      const result = await db
        .update(conversations)
        .set({ workspaceId: payload.folderId, updatedAt: new Date() })
        .where(baseConditions)
        .returning();
      return { affected: result.length, action };
    }
    default:
      throw AppError.badRequest(`Unknown bulk action: ${action}`);
  }
}

export async function getConversationsByIds(orgId: string, ids: string[]) {
  if (ids.length === 0) return [];

  return db
    .select()
    .from(conversations)
    .where(
      and(
        inArray(conversations.id, ids),
        eq(conversations.orgId, orgId),
        isNull(conversations.deletedAt),
      ),
    );
}
