import { db } from "../lib/db";
import { conversations, conversationParticipants, conversationTagAssignments, conversationTags, messages } from "@nova/shared/schemas";
import { eq, and, isNull, desc, ilike, sql, inArray, asc, lte } from "drizzle-orm";
import type { Conversation } from "@nova/shared/schemas";
import { parsePagination, buildPaginatedResponse, type PaginationInput } from "@nova/shared/utils";
import { AppError } from "@nova/shared/utils";
import { chatCompletion, getDefaultChatModel } from "../lib/litellm";
import { syncConversationUpsert, syncConversationDelete } from "../lib/qdrant-sync";

type UpdateConversationData = Partial<{
  title: string;
  systemPrompt: string;
  modelId: string;
  modelParams: unknown;
  visibility: string;
  isPinned: boolean;
  isArchived: boolean;
  forkedFromMessageId: string;
  publicShareToken: string;
}>;

export async function listConversations(
  orgId: string,
  userId: string,
  pagination: PaginationInput,
  filters?: { search?: string; isArchived?: boolean; isPinned?: boolean },
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
    forkedFromMessageId: data.forkedFromMessageId,
  }).returning();

  const conversation = result[0];

  await db.insert(conversationParticipants).values({
    conversationId: conversation.id,
    userId,
    orgId,
    role: "owner",
  });

  syncConversationUpsert(conversation as any);

  return conversation;
}

export async function updateConversation(orgId: string, conversationId: string, data: UpdateConversationData) {
  const result = await db
    .update(conversations)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId), isNull(conversations.deletedAt)))
    .returning();
  const conv = result[0] ?? null;
  if (conv) syncConversationUpsert(conv as any);
  return conv;
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
  if (result[0]) syncConversationDelete(conversationId);
  return result[0] ?? null;
}

export async function pinConversation(orgId: string, conversationId: string, isPinned: boolean) {
  return updateConversation(orgId, conversationId, { isPinned });
}

export async function forkConversation(orgId: string, userId: string, conversationId: string, messageId?: string) {
  const original = await getConversation(orgId, conversationId);
  if (!original) return null;

  // Determine the fork point: if messageId is provided, find that message's createdAt
  // and copy messages up to and including it. Otherwise copy all messages.
  let cutoffMessage: { createdAt: Date } | null = null;
  if (messageId) {
    const msgResult = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.conversationId, conversationId),
          eq(messages.orgId, orgId),
          isNull(messages.deletedAt),
        ),
      );
    cutoffMessage = msgResult[0] ?? null;
    if (!cutoffMessage) return null;
  }

  const forked = await createConversation(orgId, userId, {
    title: original.title ? `Fork of ${original.title}` : "Forked conversation",
    systemPrompt: original.systemPrompt ?? undefined,
    modelId: original.modelId ?? undefined,
    modelParams: original.modelParams,
    forkedFromMessageId: messageId,
  });

  // Copy messages from the original conversation up to the fork point
  const conditions = [
    eq(messages.conversationId, conversationId),
    eq(messages.orgId, orgId),
    isNull(messages.deletedAt),
  ];
  if (cutoffMessage) {
    conditions.push(lte(messages.createdAt, cutoffMessage.createdAt));
  }

  const originalMessages = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(asc(messages.createdAt));

  if (originalMessages.length > 0) {
    let totalTokens = 0;
    await db.insert(messages).values(
      originalMessages.map((m) => {
        totalTokens += (m.tokenCountPrompt ?? 0) + (m.tokenCountCompletion ?? 0);
        return {
          orgId,
          conversationId: forked.id,
          senderType: m.senderType,
          senderUserId: m.senderUserId,
          agentId: m.agentId,
          content: m.content,
          contentType: m.contentType,
          modelId: m.modelId,
          tokenCountPrompt: m.tokenCountPrompt,
          tokenCountCompletion: m.tokenCountCompletion,
          costCents: m.costCents,
          metadata: m.metadata,
        };
      }),
    );

    if (totalTokens > 0) {
      await db
        .update(conversations)
        .set({ totalTokens, updatedAt: new Date() })
        .where(eq(conversations.id, forked.id));
    }
  }

  return forked;
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
      let moved = 0;
      for (const convId of ids) {
        // Remove existing folder assignments
        await db
          .update(conversationTagAssignments)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(conversationTagAssignments.conversationId, convId),
              eq(conversationTagAssignments.orgId, orgId),
              isNull(conversationTagAssignments.deletedAt),
              sql`${conversationTagAssignments.conversationFolderId} IS NOT NULL`,
            ),
          );
        // Create new folder assignment
        const [r] = await db
          .insert(conversationTagAssignments)
          .values({ conversationId: convId, conversationFolderId: payload.folderId, orgId })
          .returning();
        if (r) moved++;
      }
      return { affected: moved, action };
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

export async function generateConversationTitle(
  msgs: { role: string; content: string }[],
  orgId?: string,
): Promise<string> {
  const result = await chatCompletion({
    model: await getDefaultChatModel(),
    messages: [
      {
        role: "system" as const,
        content: "Generate a short (5-8 word) title for this conversation. Respond with only the title.",
      },
      ...msgs.slice(0, 4).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ],
    max_tokens: 30,
    orgId,
  });
  return result.choices?.[0]?.message?.content?.trim() ?? "Untitled Conversation";
}

export async function generateConversationTags(
  msgs: { role: string; content: string }[],
  orgId?: string,
): Promise<string[]> {
  const result = await chatCompletion({
    model: await getDefaultChatModel(),
    messages: [
      {
        role: "system" as const,
        content:
          "Generate 1-3 lowercase topic tags for this conversation. " +
          "Respond with a JSON array of strings only, e.g. [\"python\",\"web-scraping\"]. " +
          "Tags should be short (1-2 words, kebab-case). No explanation.",
      },
      ...msgs.slice(0, 4).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ],
    max_tokens: 60,
    orgId,
  });
  const raw = result.choices?.[0]?.message?.content?.trim() ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((t: unknown) => typeof t === "string")
        .map((t: string) => t.toLowerCase().trim())
        .filter((t: string) => t.length > 0)
        .slice(0, 3);
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export async function assignTagsToConversation(
  orgId: string,
  userId: string,
  conversationId: string,
  tagNames: string[],
) {
  const tags: { id: string; name: string; color: string | null }[] = [];

  for (const name of tagNames) {
    // Upsert: find existing tag by org+user+name, or create
    const existing = await db
      .select()
      .from(conversationTags)
      .where(
        and(
          eq(conversationTags.orgId, orgId),
          eq(conversationTags.userId, userId),
          eq(conversationTags.name, name),
          isNull(conversationTags.deletedAt),
        ),
      );

    let tag = existing[0];
    if (!tag) {
      const [created] = await db
        .insert(conversationTags)
        .values({ orgId, userId, name })
        .returning();
      tag = created;
    }

    tags.push({ id: tag.id, name: tag.name, color: tag.color });

    // Check if assignment already exists
    const existingAssignment = await db
      .select()
      .from(conversationTagAssignments)
      .where(
        and(
          eq(conversationTagAssignments.conversationId, conversationId),
          eq(conversationTagAssignments.conversationTagId, tag.id),
          eq(conversationTagAssignments.orgId, orgId),
          isNull(conversationTagAssignments.deletedAt),
        ),
      );

    if (existingAssignment.length === 0) {
      await db.insert(conversationTagAssignments).values({
        conversationId,
        conversationTagId: tag.id,
        orgId,
      });
    }
  }

  return tags;
}
