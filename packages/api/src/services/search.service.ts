import { eq, and, isNull, sql, inArray, desc } from "drizzle-orm";
import { db } from "../lib/db";
import {
  conversations,
  conversationParticipants,
  messages,
  researchReports,
} from "@nova/shared/schemas";
import { generateEmbedding } from "../lib/litellm";
import {
  COLLECTIONS,
  searchVector,
  scrollFullText,
} from "../lib/qdrant";

interface SearchOptions {
  limit?: number;
  offset?: number;
  type?: "all" | "conversations" | "messages" | "agents" | "knowledge" | "files" | "research";
  mode?: "keyword" | "semantic";
  dateFrom?: Date;
  dateTo?: Date;
  model?: string;
  participantIds?: string[];
  userId?: string;
}

export const searchService = {
  async globalSearch(orgId: string, query: string, opts: SearchOptions = {}) {
    const limit = opts.limit ?? 20;
    const type = opts.type ?? "all";
    const mode = opts.mode ?? "keyword";
    const isSemantic = mode === "semantic";

    const shouldSearch = (t: string) => type === "all" || type === t;

    // Build participant filter
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
        return { conversations: [], messages: [], agents: [], knowledge: [], knowledgeDocuments: [], files: [], research: [], total: 0, query, mode };
      }
    }

    // Generate embedding for semantic mode
    let queryEmbedding: number[] | null = null;
    if (isSemantic) {
      queryEmbedding = await generateEmbedding(query);
    }

    const orgFilter = { key: "orgId", match: { value: orgId } };

    const [
      convResults,
      msgResults,
      agentResults,
      kbDocResults,
      fileResults,
      fileChunkResults,
      knowledgeChunkResults,
      researchResults,
    ] = await Promise.all([
      // Conversations — full-text search
      shouldSearch("conversations")
        ? scrollFullText(COLLECTIONS.CONVERSATIONS, "title", query, {
            filter: { must: [orgFilter] },
            limit,
          }).then((pts) =>
            pts.map((p) => ({
              id: p.id,
              title: p.payload.title as string,
              modelId: p.payload.modelId as string,
              type: "conversation" as const,
            })),
          )
        : Promise.resolve([]),

      // Messages — vector or full-text
      shouldSearch("messages")
        ? (async () => {
            const msgFilter: any[] = [orgFilter];
            if (participantConvIds) {
              msgFilter.push({
                key: "conversationId",
                match: { any: participantConvIds },
              });
            }

            if (isSemantic && queryEmbedding) {
              const results = await searchVector(COLLECTIONS.MESSAGES, queryEmbedding, {
                filter: { must: msgFilter },
                limit,
              });
              return results.map((r) => ({
                id: r.id,
                content: r.payload.content as string,
                conversationId: r.payload.conversationId as string,
                senderType: r.payload.senderType as string,
                score: r.score,
                type: "message" as const,
              }));
            }

            // Keyword mode — full-text
            const results = await scrollFullText(COLLECTIONS.MESSAGES, "content", query, {
              filter: { must: msgFilter },
              limit,
            });
            return results.map((p) => ({
              id: p.id,
              content: p.payload.content as string,
              conversationId: p.payload.conversationId as string,
              senderType: p.payload.senderType as string,
              type: "message" as const,
            }));
          })()
        : Promise.resolve([]),

      // Agents — full-text search on name + description
      shouldSearch("agents")
        ? (async () => {
            const byName = await scrollFullText(COLLECTIONS.AGENTS, "name", query, {
              filter: { must: [orgFilter] },
              limit,
            });
            const byDesc = await scrollFullText(COLLECTIONS.AGENTS, "description", query, {
              filter: { must: [orgFilter] },
              limit,
            });
            // Deduplicate
            const seen = new Set<string>();
            const merged = [];
            for (const p of [...byName, ...byDesc]) {
              if (!seen.has(p.id)) {
                seen.add(p.id);
                merged.push({
                  id: p.id,
                  name: p.payload.name as string,
                  description: p.payload.description as string,
                  type: "agent" as const,
                });
              }
            }
            return merged.slice(0, limit);
          })()
        : Promise.resolve([]),

      // Knowledge documents — full-text on title + summary
      shouldSearch("knowledge")
        ? (async () => {
            const byTitle = await scrollFullText(COLLECTIONS.KNOWLEDGE_DOCS, "title", query, {
              filter: { must: [orgFilter] },
              limit,
            });
            const bySummary = await scrollFullText(COLLECTIONS.KNOWLEDGE_DOCS, "summary", query, {
              filter: { must: [orgFilter] },
              limit,
            });
            const seen = new Set<string>();
            const merged = [];
            for (const p of [...byTitle, ...bySummary]) {
              if (!seen.has(p.id)) {
                seen.add(p.id);
                merged.push({
                  id: p.id,
                  title: p.payload.title as string,
                  name: p.payload.title as string,
                  summary: p.payload.summary as string,
                  collectionId: p.payload.collectionId as string,
                  type: "knowledge_document" as const,
                });
              }
            }
            return merged.slice(0, limit);
          })()
        : Promise.resolve([]),

      // Files — full-text on filename
      shouldSearch("files")
        ? scrollFullText(COLLECTIONS.FILES, "filename", query, {
            filter: { must: [orgFilter] },
            limit,
          }).then((pts) =>
            pts.map((p) => ({
              id: p.id,
              filename: p.payload.filename as string,
              type: "file" as const,
            })),
          )
        : Promise.resolve([]),

      // File chunks — vector search (semantic only)
      shouldSearch("files") && isSemantic && queryEmbedding
        ? searchVector(COLLECTIONS.FILE_CHUNKS, queryEmbedding, {
            filter: { must: [orgFilter] },
            limit,
          }).then((results) =>
            results.map((r) => ({
              id: r.id,
              fileId: r.payload.fileId as string,
              content: r.payload.content as string,
              score: r.score,
              type: "file_chunk" as const,
            })),
          )
        : Promise.resolve([]),

      // Knowledge chunks — vector search (semantic only)
      shouldSearch("knowledge") && isSemantic && queryEmbedding
        ? searchVector(COLLECTIONS.KNOWLEDGE_CHUNKS, queryEmbedding, {
            filter: { must: [orgFilter] },
            limit,
          }).then((results) =>
            results.map((r) => ({
              id: r.id,
              documentId: r.payload.documentId as string,
              content: r.payload.content as string,
              score: r.score,
              type: "knowledge_chunk" as const,
            })),
          )
        : Promise.resolve([]),

      // Research reports — still from PG (no Qdrant collection, low volume)
      shouldSearch("research")
        ? db
            .select({
              id: researchReports.id,
              query: researchReports.query,
              status: researchReports.status,
              conversationId: researchReports.conversationId,
              createdAt: researchReports.createdAt,
              type: sql<string>`'research'`,
            })
            .from(researchReports)
            .where(
              and(
                eq(researchReports.orgId, orgId),
                isNull(researchReports.deletedAt),
                sql`${researchReports.query} ILIKE ${"%" + query + "%"}`,
              ),
            )
            .orderBy(desc(researchReports.createdAt))
            .limit(limit)
        : Promise.resolve([]),
    ]);

    // Add snippets
    const messagesWithSnippets = msgResults.map((m: any) => ({
      ...m,
      snippet: m.content ? extractSnippet(m.content, query, 200) : null,
    }));

    const agentsWithSnippets = agentResults.map((a: any) => ({
      ...a,
      snippet: a.description ? extractSnippet(a.description, query, 200) : null,
    }));

    const docsWithSnippets = kbDocResults.map((d: any) => ({
      ...d,
      snippet: d.summary ? extractSnippet(d.summary, query, 200) : null,
    }));

    const researchWithSnippets = researchResults.map((r: any) => ({
      ...r,
      title: r.query,
      snippet: r.query ? extractSnippet(r.query, query, 200) : null,
    }));

    return {
      conversations: convResults,
      messages: messagesWithSnippets,
      agents: agentsWithSnippets,
      knowledge: [], // Collections not searched directly — docs + chunks cover it
      knowledgeDocuments: docsWithSnippets,
      knowledgeChunks: knowledgeChunkResults,
      files: fileResults,
      fileChunks: fileChunkResults,
      research: researchWithSnippets,
      total:
        convResults.length +
        msgResults.length +
        agentResults.length +
        kbDocResults.length +
        fileResults.length +
        fileChunkResults.length +
        knowledgeChunkResults.length +
        researchResults.length,
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
