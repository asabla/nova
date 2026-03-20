import { eq, and, desc, isNull, ilike, sql, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { knowledgeCollections, knowledgeDocuments, knowledgeChunks, knowledgeTags, knowledgeDocumentTagAssignments } from "@nova/shared/schemas";
import { auditLogs } from "@nova/shared/schema";
import { AppError } from "@nova/shared/utils";
import { getTemporalClient } from "../lib/temporal";
import { syncKnowledgeDocUpsert, syncKnowledgeDocDelete, syncKnowledgeChunksByDocumentDelete, syncKnowledgeChunksByCollectionDelete } from "../lib/qdrant-sync";
import { searchVector, COLLECTIONS } from "../lib/qdrant";

export const knowledgeService = {
  async listCollections(orgId: string, opts?: { search?: string; limit?: number; offset?: number }) {
    const conditions = [
      eq(knowledgeCollections.orgId, orgId),
    ];
    if (opts?.search) {
      conditions.push(ilike(knowledgeCollections.name, `%${opts.search}%`));
    }

    const result = await db
      .select()
      .from(knowledgeCollections)
      .where(and(...conditions))
      .orderBy(desc(knowledgeCollections.updatedAt))
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeCollections)
      .where(and(...conditions));

    return { data: result, total: count };
  },

  async getCollection(orgId: string, collectionId: string) {
    const [collection] = await db
      .select()
      .from(knowledgeCollections)
      .where(and(eq(knowledgeCollections.id, collectionId), eq(knowledgeCollections.orgId, orgId)));

    if (!collection) throw AppError.notFound("Collection not found");
    return collection;
  },

  async createCollection(orgId: string, userId: string, data: {
    name: string;
    description?: string;
    embeddingModelId?: string;
    source?: string;
  }) {
    const [collection] = await db
      .insert(knowledgeCollections)
      .values({
        orgId,
        ownerId: userId,
        name: data.name,
        description: data.description,
        embeddingModelId: data.embeddingModelId,
        source: data.source ?? "manual",
        status: "active",
      })
      .returning();

    return collection;
  },

  async updateCollection(orgId: string, collectionId: string, data: Partial<{
    name: string;
    description: string;
  }>) {
    const [collection] = await db
      .update(knowledgeCollections)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(knowledgeCollections.id, collectionId), eq(knowledgeCollections.orgId, orgId)))
      .returning();

    if (!collection) throw AppError.notFound("Collection not found");
    return collection;
  },

  async deleteCollection(orgId: string, collectionId: string) {
    await db.delete(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.knowledgeCollectionId, collectionId), eq(knowledgeDocuments.orgId, orgId)));

    const [collection] = await db
      .delete(knowledgeCollections)
      .where(and(eq(knowledgeCollections.id, collectionId), eq(knowledgeCollections.orgId, orgId)))
      .returning();

    if (!collection) throw AppError.notFound("Collection not found");
    syncKnowledgeChunksByCollectionDelete(collectionId);
    return collection;
  },

  async listDocuments(orgId: string, collectionId: string, opts?: { tagId?: string }) {
    const conditions = [
      eq(knowledgeDocuments.knowledgeCollectionId, collectionId),
      eq(knowledgeDocuments.orgId, orgId),
    ];

    if (opts?.tagId) {
      // Filter by tag — join through assignments
      const docIds = db
        .select({ id: knowledgeDocumentTagAssignments.knowledgeDocumentId })
        .from(knowledgeDocumentTagAssignments)
        .where(eq(knowledgeDocumentTagAssignments.knowledgeTagId, opts.tagId));

      const docs = await db
        .select()
        .from(knowledgeDocuments)
        .where(and(...conditions, sql`${knowledgeDocuments.id} IN (${docIds})`))
        .orderBy(desc(knowledgeDocuments.createdAt));

      return this._attachTags(orgId, docs);
    }

    const docs = await db
      .select()
      .from(knowledgeDocuments)
      .where(and(...conditions))
      .orderBy(desc(knowledgeDocuments.createdAt));

    return this._attachTags(orgId, docs);
  },

  async _attachTags(orgId: string, docs: (typeof knowledgeDocuments.$inferSelect)[]) {
    if (docs.length === 0) return docs;

    const docIds = docs.map((d) => d.id);
    const allAssignments = await db
      .select({
        documentId: knowledgeDocumentTagAssignments.knowledgeDocumentId,
        tagId: knowledgeTags.id,
        tagName: knowledgeTags.name,
        tagColor: knowledgeTags.color,
        source: knowledgeDocumentTagAssignments.source,
      })
      .from(knowledgeDocumentTagAssignments)
      .innerJoin(knowledgeTags, eq(knowledgeDocumentTagAssignments.knowledgeTagId, knowledgeTags.id))
      .where(and(
        eq(knowledgeDocumentTagAssignments.orgId, orgId),
        sql`${knowledgeDocumentTagAssignments.knowledgeDocumentId} IN (${sql.join(docIds.map((id) => sql`${id}`), sql`, `)})`,
      ));

    const tagsByDoc = new Map<string, { id: string; name: string; color: string | null; source: string }[]>();
    for (const a of allAssignments) {
      const list = tagsByDoc.get(a.documentId) ?? [];
      list.push({ id: a.tagId, name: a.tagName, color: a.tagColor, source: a.source });
      tagsByDoc.set(a.documentId, list);
    }

    return docs.map((d) => ({ ...d, tags: tagsByDoc.get(d.id) ?? [] }));
  },

  async addDocument(orgId: string, collectionId: string, data: {
    title: string;
    sourceUrl?: string;
    fileId?: string;
    content?: string;
  }) {
    const [doc] = await db
      .insert(knowledgeDocuments)
      .values({
        orgId,
        knowledgeCollectionId: collectionId,
        title: data.title,
        sourceUrl: data.sourceUrl,
        fileId: data.fileId,
        content: data.content,
        status: "pending",
      })
      .returning();

    syncKnowledgeDocUpsert(doc as any);

    return doc;
  },

  async deleteDocument(orgId: string, docId: string) {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.knowledgeDocumentId, docId));
    const [doc] = await db
      .delete(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeDocuments.orgId, orgId)))
      .returning();

    if (!doc) throw AppError.notFound("Document not found");
    syncKnowledgeDocDelete(docId);
    syncKnowledgeChunksByDocumentDelete(docId);
    return doc;
  },

  async removeDocument(orgId: string, docId: string) {
    const [doc] = await db
      .update(knowledgeDocuments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeDocuments.orgId, orgId), isNull(knowledgeDocuments.deletedAt)))
      .returning();

    if (!doc) throw AppError.notFound("Document not found");

    // Soft-delete associated chunks
    await db
      .update(knowledgeChunks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(knowledgeChunks.knowledgeDocumentId, docId), eq(knowledgeChunks.orgId, orgId)));

    syncKnowledgeDocDelete(docId);
    syncKnowledgeChunksByDocumentDelete(docId);

    return doc;
  },

  async reindexCollection(orgId: string, collectionId: string) {
    // Verify collection exists
    const collection = await this.getCollection(orgId, collectionId);

    // Mark all non-deleted documents for re-indexing
    await db
      .update(knowledgeDocuments)
      .set({ status: "pending", updatedAt: new Date() })
      .where(and(
        eq(knowledgeDocuments.knowledgeCollectionId, collectionId),
        eq(knowledgeDocuments.orgId, orgId),
        isNull(knowledgeDocuments.deletedAt),
      ));

    // Update collection status
    const [updated] = await db
      .update(knowledgeCollections)
      .set({ status: "indexing", updatedAt: new Date() })
      .where(and(eq(knowledgeCollections.id, collectionId), eq(knowledgeCollections.orgId, orgId)))
      .returning();

    return updated;
  },

  async queryCollection(orgId: string, collectionId: string, query: string, opts?: { topK?: number; threshold?: number }) {
    const topK = opts?.topK ?? 5;
    const threshold = opts?.threshold ?? 0.0;

    // Verify collection exists and belongs to org
    const collection = await this.getCollection(orgId, collectionId);

    // Generate embedding for the query text
    let queryEmbedding: number[] | null = null;
    try {
      const { generateEmbedding } = await import("../lib/litellm");
      queryEmbedding = await generateEmbedding(query, collection.embeddingModel ?? undefined);
    } catch {
      // Fallback to text similarity if embedding API is unavailable
    }

    if (queryEmbedding) {
      // Use Qdrant vector search
      try {
        const results = await searchVector(COLLECTIONS.KNOWLEDGE_CHUNKS, queryEmbedding, {
          filter: {
            must: [
              { key: "orgId", match: { value: orgId } },
              { key: "collectionId", match: { value: collectionId } },
            ],
          },
          limit: topK,
          scoreThreshold: threshold > 0 ? threshold : undefined,
        });

        if (results.length > 0) {
          // Fetch full chunk details from PG
          const chunkIds = results.map((r) => r.id);
          const chunks = await db
            .select({
              id: knowledgeChunks.id,
              documentId: knowledgeChunks.knowledgeDocumentId,
              content: knowledgeChunks.content,
              chunkIndex: knowledgeChunks.chunkIndex,
              metadata: knowledgeChunks.metadata,
            })
            .from(knowledgeChunks)
            .where(inArray(knowledgeChunks.id, chunkIds));

          const chunkMap = new Map(chunks.map((c) => [c.id, c]));

          // Fetch document names
          const docIds = [...new Set(chunks.map((c) => c.documentId))];
          const docs = docIds.length > 0
            ? await db
                .select({ id: knowledgeDocuments.id, title: knowledgeDocuments.title, summary: knowledgeDocuments.summary })
                .from(knowledgeDocuments)
                .where(inArray(knowledgeDocuments.id, docIds))
            : [];
          const docMap = new Map(docs.map((d) => [d.id, d]));

          return results
            .map((r) => {
              const chunk = chunkMap.get(r.id);
              if (!chunk) return null;
              const doc = docMap.get(chunk.documentId);
              return {
                id: r.id,
                documentId: chunk.documentId,
                documentName: doc?.title ?? null,
                documentSummary: doc?.summary ?? null,
                content: chunk.content,
                chunkIndex: chunk.chunkIndex,
                score: r.score,
                metadata: chunk.metadata,
              };
            })
            .filter(Boolean) as any[];
        }
      } catch (err) {
        console.warn("[knowledge] Qdrant search failed, falling back to pg_trgm:", err);
      }
    }

    // Fallback: pg_trgm text similarity
    const fallbackResults = await db.execute(sql`
      SELECT
        kc.id,
        kc.knowledge_document_id AS "documentId",
        kd.title AS "documentName",
        kd.summary AS "documentSummary",
        kc.content,
        kc.chunk_index AS "chunkIndex",
        kc.metadata,
        similarity(kc.content, ${query}) AS score
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.knowledge_document_id
      WHERE kc.knowledge_collection_id = ${collectionId}
        AND kc.org_id = ${orgId}
        AND kc.deleted_at IS NULL
        AND kd.deleted_at IS NULL
      ORDER BY score DESC
      LIMIT ${topK}
    `);

    return (fallbackResults as any[])
      .filter((r: any) => parseFloat(r.score) >= threshold)
      .map((r: any) => ({
        id: r.id,
        documentId: r.documentId,
        documentName: r.documentName,
        documentSummary: r.documentSummary ?? null,
        content: r.content,
        chunkIndex: r.chunkIndex,
        score: parseFloat(r.score) || 0,
        metadata: r.metadata,
      }));
  },

  async getChunks(orgId: string, docId: string) {
    return db
      .select()
      .from(knowledgeChunks)
      .where(and(
        eq(knowledgeChunks.knowledgeDocumentId, docId),
        eq(knowledgeChunks.orgId, orgId),
        isNull(knowledgeChunks.deletedAt),
      ))
      .orderBy(knowledgeChunks.chunkIndex);
  },

  async updateCollectionConfig(orgId: string, collectionId: string, config: {
    embeddingModel?: string;
    chunkSize?: number;
    chunkOverlap?: number;
  }) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (config.embeddingModel !== undefined) {
      updates.embeddingModel = config.embeddingModel;
    }
    if (config.chunkSize !== undefined) {
      if (config.chunkSize < 64 || config.chunkSize > 8192) {
        throw AppError.badRequest("chunkSize must be between 64 and 8192");
      }
      updates.chunkSize = config.chunkSize;
    }
    if (config.chunkOverlap !== undefined) {
      if (config.chunkOverlap < 0) {
        throw AppError.badRequest("chunkOverlap must be >= 0");
      }
      updates.chunkOverlap = config.chunkOverlap;
    }

    const [collection] = await db
      .update(knowledgeCollections)
      .set(updates)
      .where(and(eq(knowledgeCollections.id, collectionId), eq(knowledgeCollections.orgId, orgId)))
      .returning();

    if (!collection) throw AppError.notFound("Collection not found");
    return collection;
  },

  async listTags(orgId: string, opts?: { search?: string }) {
    const conditions = [eq(knowledgeTags.orgId, orgId)];
    if (opts?.search) {
      conditions.push(ilike(knowledgeTags.name, `%${opts.search}%`));
    }
    return db.select().from(knowledgeTags).where(and(...conditions)).orderBy(knowledgeTags.name);
  },

  async createTag(orgId: string, data: { name: string; color?: string }) {
    const [tag] = await db.insert(knowledgeTags).values({
      orgId,
      name: data.name.toLowerCase().trim(),
      color: data.color,
      source: "manual",
    }).returning();
    return tag;
  },

  async deleteTag(orgId: string, tagId: string) {
    // Cascade deletes assignments via FK
    const [tag] = await db.delete(knowledgeTags)
      .where(and(eq(knowledgeTags.id, tagId), eq(knowledgeTags.orgId, orgId)))
      .returning();
    if (!tag) throw AppError.notFound("Tag not found");
    return tag;
  },

  async getDocumentTags(orgId: string, docId: string) {
    return db.select({
      id: knowledgeTags.id,
      name: knowledgeTags.name,
      color: knowledgeTags.color,
      source: knowledgeDocumentTagAssignments.source,
    })
      .from(knowledgeDocumentTagAssignments)
      .innerJoin(knowledgeTags, eq(knowledgeDocumentTagAssignments.knowledgeTagId, knowledgeTags.id))
      .where(and(
        eq(knowledgeDocumentTagAssignments.knowledgeDocumentId, docId),
        eq(knowledgeDocumentTagAssignments.orgId, orgId),
      ));
  },

  async addTagToDocument(orgId: string, docId: string, tagName: string) {
    const normalizedName = tagName.toLowerCase().trim();

    // Upsert tag
    await db.insert(knowledgeTags).values({
      orgId,
      name: normalizedName,
      source: "manual",
    }).onConflictDoNothing({ target: [knowledgeTags.orgId, knowledgeTags.name] });

    const [tag] = await db.select().from(knowledgeTags).where(
      and(eq(knowledgeTags.orgId, orgId), eq(knowledgeTags.name, normalizedName)),
    );
    if (!tag) throw AppError.badRequest("Failed to create tag");

    // Create assignment
    await db.insert(knowledgeDocumentTagAssignments).values({
      knowledgeDocumentId: docId,
      knowledgeTagId: tag.id,
      orgId,
      source: "manual",
    }).onConflictDoNothing();

    return tag;
  },

  async removeTagFromDocument(orgId: string, docId: string, tagId: string) {
    const [assignment] = await db.delete(knowledgeDocumentTagAssignments)
      .where(and(
        eq(knowledgeDocumentTagAssignments.knowledgeDocumentId, docId),
        eq(knowledgeDocumentTagAssignments.knowledgeTagId, tagId),
        eq(knowledgeDocumentTagAssignments.orgId, orgId),
      ))
      .returning();
    if (!assignment) throw AppError.notFound("Tag assignment not found");
    return assignment;
  },

  async getCollectionHistory(orgId: string, collectionId: string, opts?: { limit?: number; offset?: number }) {
    // Verify collection exists and belongs to org
    await this.getCollection(orgId, collectionId);

    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    const entries = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorId: auditLogs.actorId,
        actorType: auditLogs.actorType,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.orgId, orgId),
          eq(auditLogs.resourceId, collectionId),
          eq(auditLogs.resourceType, "knowledge_collection"),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.orgId, orgId),
          eq(auditLogs.resourceId, collectionId),
          eq(auditLogs.resourceType, "knowledge_collection"),
        ),
      );

    return { data: entries, total: count };
  },
};

export async function triggerDocumentIngestion(
  doc: { id: string; fileId?: string | null; sourceUrl?: string | null },
  orgId: string,
  collectionId: string,
) {
  try {
    const client = await getTemporalClient();
    await client.workflow.start("documentIngestionWorkflow", {
      taskQueue: "nova-main",
      workflowId: `doc-ingest-${doc.id}`,
      args: [{
        orgId,
        collectionId,
        documentId: doc.id,
        fileId: doc.fileId ?? undefined,
        sourceUrl: doc.sourceUrl ?? undefined,
      }],
    });
  } catch (err) {
    console.error(`[knowledge] Failed to start ingestion workflow for doc ${doc.id}:`, err);
  }
}
