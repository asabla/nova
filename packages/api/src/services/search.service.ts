import { eq, and, or, ilike, isNull, sql, gte, lte, inArray, desc } from "drizzle-orm";
import { db } from "../lib/db";
import {
  conversations,
  conversationParticipants,
  messages,
  agents,
  knowledgeCollections,
  files,
} from "@nova/shared/schemas";

interface SearchOptions {
  limit?: number;
  offset?: number;
  type?: "all" | "conversations" | "messages" | "agents" | "knowledge" | "files";
  mode?: "keyword" | "semantic";
  dateFrom?: Date;
  dateTo?: Date;
  workspaceId?: string;
  model?: string;
  participantIds?: string[];
  userId?: string;
}

export const searchService = {
  async globalSearch(orgId: string, query: string, opts: SearchOptions = {}) {
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;
    const type = opts.type ?? "all";
    const mode = opts.mode ?? "keyword";
    const pattern = `%${query}%`;

    const shouldSearch = (t: string) => type === "all" || type === t;

    const dateConditions = (table: any) => {
      const conds = [];
      if (opts.dateFrom) conds.push(gte(table.createdAt, opts.dateFrom));
      if (opts.dateTo) conds.push(lte(table.createdAt, opts.dateTo));
      return conds;
    };

    // If semantic mode, try to use pgvector similarity search on messages
    // Falls back to keyword search if embeddings are not available
    const isSemantic = mode === "semantic";

    // Build participant filter: find conversation IDs where these users participate
    let participantConvIds: string[] | undefined;
    if (opts.participantIds && opts.participantIds.length > 0) {
      const participantRows = await db
        .select({ conversationId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.orgId, orgId),
            inArray(conversationParticipants.userId, opts.participantIds),
            isNull(conversationParticipants.deletedAt),
          ),
        );
      participantConvIds = participantRows.map((r) => r.conversationId);
      if (participantConvIds.length === 0) {
        // No conversations match the participant filter
        return { conversations: [], messages: [], agents: [], knowledge: [], files: [], total: 0 };
      }
    }

    const [convResults, msgResults, agentResults, kbResults, fileResults] = await Promise.all([
      // --- Conversations ---
      shouldSearch("conversations")
        ? db
            .select({
              id: conversations.id,
              title: conversations.title,
              modelId: conversations.modelId,
              workspaceId: conversations.workspaceId,
              createdAt: conversations.createdAt,
              updatedAt: conversations.updatedAt,
              type: sql<string>`'conversation'`,
            })
            .from(conversations)
            .where(
              and(
                eq(conversations.orgId, orgId),
                isNull(conversations.deletedAt),
                ilike(conversations.title, pattern),
                ...(opts.workspaceId ? [eq(conversations.workspaceId, opts.workspaceId)] : []),
                ...(opts.model ? [eq(conversations.modelId, opts.model)] : []),
                ...(participantConvIds ? [inArray(conversations.id, participantConvIds)] : []),
                ...dateConditions(conversations),
              ),
            )
            .orderBy(desc(conversations.updatedAt))
            .limit(limit)
            .offset(offset)
        : Promise.resolve([]),

      // --- Messages ---
      shouldSearch("messages")
        ? (async () => {
            if (isSemantic) {
              // Attempt semantic search using pgvector cosine similarity
              // This requires the messages table to have an `embedding` vector column
              // If the column doesn't exist, fall back to keyword search
              try {
                const semanticResults = await db.execute(
                  sql`
                    SELECT
                      m.id,
                      m.content,
                      m.conversation_id AS "conversationId",
                      m.sender_type AS "senderType",
                      m.created_at AS "createdAt",
                      'message' AS type,
                      1 - (m.embedding <=> (
                        SELECT embedding FROM messages
                        WHERE org_id = ${orgId}
                          AND content ILIKE ${pattern}
                          AND embedding IS NOT NULL
                          AND deleted_at IS NULL
                        LIMIT 1
                      )) AS score
                    FROM messages m
                    WHERE m.org_id = ${orgId}
                      AND m.deleted_at IS NULL
                      AND m.embedding IS NOT NULL
                      ${opts.dateFrom ? sql`AND m.created_at >= ${opts.dateFrom}` : sql``}
                      ${opts.dateTo ? sql`AND m.created_at <= ${opts.dateTo}` : sql``}
                      ${
                        participantConvIds
                          ? sql`AND m.conversation_id = ANY(${participantConvIds})`
                          : sql``
                      }
                    ORDER BY score DESC
                    LIMIT ${limit}
                    OFFSET ${offset}
                  `,
                );
                return (Array.isArray(semanticResults) ? semanticResults : []) as any[];
              } catch {
                // Fall back to keyword search if embedding column doesn't exist
              }
            }

            // Keyword search
            const baseConditions = [
              eq(messages.orgId, orgId),
              isNull(messages.deletedAt),
              ilike(messages.content, pattern),
              ...dateConditions(messages),
            ];
            if (participantConvIds) {
              baseConditions.push(inArray(messages.conversationId, participantConvIds));
            }

            return db
              .select({
                id: messages.id,
                content: messages.content,
                conversationId: messages.conversationId,
                senderType: messages.senderType,
                createdAt: messages.createdAt,
                type: sql<string>`'message'`,
              })
              .from(messages)
              .where(and(...baseConditions))
              .orderBy(desc(messages.createdAt))
              .limit(limit)
              .offset(offset);
          })()
        : Promise.resolve([]),

      // --- Agents ---
      shouldSearch("agents")
        ? db
            .select({
              id: agents.id,
              name: agents.name,
              description: agents.description,
              visibility: agents.visibility,
              createdAt: agents.createdAt,
              type: sql<string>`'agent'`,
            })
            .from(agents)
            .where(
              and(
                eq(agents.orgId, orgId),
                isNull(agents.deletedAt),
                or(ilike(agents.name, pattern), ilike(agents.description, pattern)),
                ...dateConditions(agents),
              ),
            )
            .orderBy(desc(agents.createdAt))
            .limit(limit)
            .offset(offset)
        : Promise.resolve([]),

      // --- Knowledge collections ---
      shouldSearch("knowledge")
        ? db
            .select({
              id: knowledgeCollections.id,
              name: knowledgeCollections.name,
              description: knowledgeCollections.description,
              createdAt: knowledgeCollections.createdAt,
              type: sql<string>`'knowledge'`,
            })
            .from(knowledgeCollections)
            .where(
              and(
                eq(knowledgeCollections.orgId, orgId),
                isNull(knowledgeCollections.deletedAt),
                or(
                  ilike(knowledgeCollections.name, pattern),
                  ilike(knowledgeCollections.description, pattern),
                ),
                ...dateConditions(knowledgeCollections),
              ),
            )
            .orderBy(desc(knowledgeCollections.createdAt))
            .limit(limit)
            .offset(offset)
        : Promise.resolve([]),

      // --- Files ---
      shouldSearch("files")
        ? db
            .select({
              id: files.id,
              filename: files.filename,
              contentType: files.contentType,
              sizeBytes: files.sizeBytes,
              createdAt: files.createdAt,
              type: sql<string>`'file'`,
            })
            .from(files)
            .where(
              and(
                eq(files.orgId, orgId),
                isNull(files.deletedAt),
                ilike(files.filename, pattern),
                ...dateConditions(files),
              ),
            )
            .orderBy(desc(files.createdAt))
            .limit(limit)
            .offset(offset)
        : Promise.resolve([]),
    ]);

    // Add context snippets with match highlighting to message results
    const messagesWithSnippets = msgResults.map((m: any) => ({
      ...m,
      snippet: m.content ? extractSnippet(m.content, query, 200) : null,
    }));

    // Add snippets to agent/knowledge descriptions
    const agentsWithSnippets = agentResults.map((a: any) => ({
      ...a,
      snippet: a.description ? extractSnippet(a.description, query, 200) : null,
    }));

    const knowledgeWithSnippets = kbResults.map((k: any) => ({
      ...k,
      snippet: k.description ? extractSnippet(k.description, query, 200) : null,
    }));

    return {
      conversations: convResults,
      messages: messagesWithSnippets,
      agents: agentsWithSnippets,
      knowledge: knowledgeWithSnippets,
      files: fileResults,
      total:
        convResults.length +
        msgResults.length +
        agentResults.length +
        kbResults.length +
        fileResults.length,
      query,
      mode,
    };
  },
};

/**
 * Extract a context snippet around the first match with surrounding text.
 */
function extractSnippet(text: string, query: string, maxLen: number): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return text.slice(0, maxLen);

  const contextBefore = 60;
  const contextAfter = 120;
  const start = Math.max(0, idx - contextBefore);
  const end = Math.min(text.length, idx + query.length + contextAfter);
  let snippet = text.slice(start, end);

  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}
