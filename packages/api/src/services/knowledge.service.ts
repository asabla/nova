import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { knowledgeCollections, knowledgeDocuments, knowledgeChunks } from "@nova/shared/schemas";
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
  }) {
    const [doc] = await db
      .insert(knowledgeDocuments)
      .values({
        orgId,
        knowledgeCollectionId: collectionId,
        title: data.title,
        sourceUrl: data.sourceUrl,
        fileId: data.fileId,
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
};
