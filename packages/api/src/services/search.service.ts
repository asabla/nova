import { eq, and, or, ilike, isNull, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { conversations, messages, agents, knowledgeCollections } from "@nova/shared/schemas";

export const searchService = {
  async globalSearch(orgId: string, query: string, opts?: { limit?: number }) {
    const limit = opts?.limit ?? 10;
    const pattern = `%${query}%`;

    const [convResults, msgResults, agentResults, kbResults] = await Promise.all([
      db.select({ id: conversations.id, title: conversations.title, type: sql<string>`'conversation'` })
        .from(conversations)
        .where(and(
          eq(conversations.orgId, orgId),
          isNull(conversations.deletedAt),
          ilike(conversations.title, pattern),
        ))
        .limit(limit),

      db.select({ id: messages.id, content: messages.content, conversationId: messages.conversationId, type: sql<string>`'message'` })
        .from(messages)
        .where(and(
          eq(messages.orgId, orgId),
          isNull(messages.deletedAt),
          ilike(messages.content, pattern),
        ))
        .limit(limit),

      db.select({ id: agents.id, name: agents.name, type: sql<string>`'agent'` })
        .from(agents)
        .where(and(
          eq(agents.orgId, orgId),
          isNull(agents.deletedAt),
          or(ilike(agents.name, pattern), ilike(agents.description, pattern)),
        ))
        .limit(limit),

      db.select({ id: knowledgeCollections.id, name: knowledgeCollections.name, type: sql<string>`'knowledge'` })
        .from(knowledgeCollections)
        .where(and(
          eq(knowledgeCollections.orgId, orgId),
          isNull(knowledgeCollections.deletedAt),
          ilike(knowledgeCollections.name, pattern),
        ))
        .limit(limit),
    ]);

    return {
      conversations: convResults,
      messages: msgResults,
      agents: agentResults,
      knowledge: kbResults,
    };
  },
};
