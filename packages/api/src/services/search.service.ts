import { eq, and, or, ilike, isNull, sql, gte, lte } from "drizzle-orm";
import { db } from "../lib/db";
import { conversations, messages, agents, knowledgeCollections, files, promptTemplates } from "@nova/shared/schemas";

interface SearchOptions {
  limit?: number;
  type?: "all" | "conversations" | "messages" | "agents" | "knowledge" | "files";
  dateFrom?: Date;
  dateTo?: Date;
  workspaceId?: string;
  userId?: string;
}

export const searchService = {
  async globalSearch(orgId: string, query: string, opts: SearchOptions = {}) {
    const limit = opts.limit ?? 10;
    const pattern = `%${query}%`;
    const type = opts.type ?? "all";

    const dateConditions = (table: any) => {
      const conds = [];
      if (opts.dateFrom) conds.push(gte(table.createdAt, opts.dateFrom));
      if (opts.dateTo) conds.push(lte(table.createdAt, opts.dateTo));
      return conds;
    };

    const shouldSearch = (t: string) => type === "all" || type === t;

    const [convResults, msgResults, agentResults, kbResults, fileResults] = await Promise.all([
      shouldSearch("conversations")
        ? db.select({
            id: conversations.id,
            title: conversations.title,
            createdAt: conversations.createdAt,
            updatedAt: conversations.updatedAt,
            workspaceId: conversations.workspaceId,
            type: sql<string>`'conversation'`,
          })
          .from(conversations)
          .where(and(
            eq(conversations.orgId, orgId),
            isNull(conversations.deletedAt),
            ilike(conversations.title, pattern),
            ...(opts.workspaceId ? [eq(conversations.workspaceId, opts.workspaceId)] : []),
            ...dateConditions(conversations),
          ))
          .limit(limit)
        : Promise.resolve([]),

      shouldSearch("messages")
        ? db.select({
            id: messages.id,
            content: messages.content,
            conversationId: messages.conversationId,
            senderType: messages.senderType,
            createdAt: messages.createdAt,
            type: sql<string>`'message'`,
          })
          .from(messages)
          .where(and(
            eq(messages.orgId, orgId),
            isNull(messages.deletedAt),
            ilike(messages.content, pattern),
            ...dateConditions(messages),
          ))
          .limit(limit)
        : Promise.resolve([]),

      shouldSearch("agents")
        ? db.select({
            id: agents.id,
            name: agents.name,
            description: agents.description,
            visibility: agents.visibility,
            createdAt: agents.createdAt,
            type: sql<string>`'agent'`,
          })
          .from(agents)
          .where(and(
            eq(agents.orgId, orgId),
            isNull(agents.deletedAt),
            or(ilike(agents.name, pattern), ilike(agents.description, pattern)),
            ...dateConditions(agents),
          ))
          .limit(limit)
        : Promise.resolve([]),

      shouldSearch("knowledge")
        ? db.select({
            id: knowledgeCollections.id,
            name: knowledgeCollections.name,
            description: knowledgeCollections.description,
            createdAt: knowledgeCollections.createdAt,
            type: sql<string>`'knowledge'`,
          })
          .from(knowledgeCollections)
          .where(and(
            eq(knowledgeCollections.orgId, orgId),
            isNull(knowledgeCollections.deletedAt),
            or(ilike(knowledgeCollections.name, pattern), ilike(knowledgeCollections.description, pattern)),
            ...dateConditions(knowledgeCollections),
          ))
          .limit(limit)
        : Promise.resolve([]),

      shouldSearch("files")
        ? db.select({
            id: files.id,
            filename: files.filename,
            mimeType: files.mimeType,
            sizeBytes: files.sizeBytes,
            createdAt: files.createdAt,
            type: sql<string>`'file'`,
          })
          .from(files)
          .where(and(
            eq(files.orgId, orgId),
            isNull(files.deletedAt),
            ilike(files.filename, pattern),
            ...dateConditions(files),
          ))
          .limit(limit)
        : Promise.resolve([]),
    ]);

    // Add context snippets to message results
    const messagesWithSnippets = msgResults.map((m: any) => ({
      ...m,
      snippet: m.content
        ? highlightSnippet(m.content, query, 150)
        : null,
    }));

    return {
      conversations: convResults,
      messages: messagesWithSnippets,
      agents: agentResults,
      knowledge: kbResults,
      files: fileResults,
      total: convResults.length + msgResults.length + agentResults.length + kbResults.length + fileResults.length,
    };
  },
};

function highlightSnippet(text: string, query: string, maxLen: number): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen);

  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + query.length + 100);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}
