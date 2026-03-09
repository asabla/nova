import { eq, and, desc, isNull, ilike, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { knowledgeCollections, knowledgeDocuments, knowledgeChunks } from "@nova/shared/schemas";
import { auditLogs } from "@nova/shared/schema";
import { AppError } from "@nova/shared/utils";

export const knowledgeService = {
  async listCollections(orgId: string, opts?: { search?: string; limit?: number; offset?: number }) {
    const conditions = [eq(knowledgeCollections.orgId, orgId)];
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
  }) {
    const [collection] = await db
      .insert(knowledgeCollections)
      .values({
        orgId,
        ownerId: userId,
        name: data.name,
        description: data.description,
        embeddingModelId: data.embeddingModelId,
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
    return collection;
  },

  async listDocuments(orgId: string, collectionId: string) {
    return db
      .select()
      .from(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.knowledgeCollectionId, collectionId), eq(knowledgeDocuments.orgId, orgId)))
      .orderBy(desc(knowledgeDocuments.createdAt));
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

    return doc;
  },

  async deleteDocument(orgId: string, docId: string) {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.knowledgeDocumentId, docId));
    const [doc] = await db
      .delete(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeDocuments.orgId, orgId)))
      .returning();

    if (!doc) throw AppError.notFound("Document not found");
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
    await this.getCollection(orgId, collectionId);

    // Generate embedding for the query text via LiteLLM
    let queryEmbedding: number[] | null = null;
    try {
      const { generateEmbedding } = await import("../lib/litellm");
      queryEmbedding = await generateEmbedding(query);
    } catch {
      // Fallback to text similarity if embedding API is unavailable
    }

    // Use pgvector cosine distance if we have an embedding, otherwise pg_trgm text similarity
    const results = queryEmbedding
      ? await db.execute(sql`
          SELECT
            kc.id,
            kc.knowledge_document_id AS "documentId",
            kd.title AS "documentName",
            kc.content,
            kc.chunk_index AS "chunkIndex",
            kc.metadata,
            1 - (kc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS score
          FROM knowledge_chunks kc
          JOIN knowledge_documents kd ON kd.id = kc.knowledge_document_id
          WHERE kc.knowledge_collection_id = ${collectionId}
            AND kc.org_id = ${orgId}
            AND kc.deleted_at IS NULL
            AND kd.deleted_at IS NULL
            AND kc.embedding IS NOT NULL
          ORDER BY kc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
          LIMIT ${topK}
        `)
      : await db.execute(sql`
          SELECT
            kc.id,
            kc.knowledge_document_id AS "documentId",
            kd.title AS "documentName",
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

    const rows = (results as any[]).filter((r: any) => r.score >= threshold);

    return rows.map((r: any) => ({
      id: r.id,
      documentId: r.documentId,
      documentName: r.documentName,
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
      updates.embeddingModelId = config.embeddingModel;
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
