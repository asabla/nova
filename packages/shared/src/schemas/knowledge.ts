import { pgTable, text, uuid, timestamp, integer, jsonb, index, customType } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";

// pgvector column with no fixed dimension — accepts any embedding size
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return "vector";
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown) {
    if (typeof value === "string") return JSON.parse(value) as number[];
    if (Array.isArray(value)) return value as number[];
    return [];
  },
});

export const knowledgeCollections = pgTable("knowledge_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  visibility: text("visibility").notNull().default("private"),
  embeddingModelId: uuid("embedding_model_id"),
  embeddingModel: text("embedding_model"),
  chunkSize: integer("chunk_size").notNull().default(512),
  chunkOverlap: integer("chunk_overlap").notNull().default(64),
  source: text("source").notNull().default("manual"),
  version: integer("version").notNull().default(1),
  lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_knowledge_collections_org_owner").on(table.orgId, table.ownerId),
  index("idx_knowledge_collections_org_active").on(table.orgId),
]);

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgeCollectionId: uuid("knowledge_collection_id").notNull().references(() => knowledgeCollections.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  fileId: uuid("file_id"),
  sourceUrl: text("source_url"),
  title: text("title"),
  content: text("content"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  tokenCount: integer("token_count"),
  chunkCount: integer("chunk_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_knowledge_documents_collection").on(table.knowledgeCollectionId),
  index("idx_knowledge_documents_org_id").on(table.orgId),
]);

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgeDocumentId: uuid("knowledge_document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  knowledgeCollectionId: uuid("knowledge_collection_id").notNull().references(() => knowledgeCollections.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding"),
  tokenCount: integer("token_count"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_knowledge_chunks_document_index").on(table.knowledgeDocumentId, table.chunkIndex),
  index("idx_knowledge_chunks_collection").on(table.knowledgeCollectionId),
  index("idx_knowledge_chunks_org_id").on(table.orgId),
]);

export const selectKnowledgeCollectionSchema = createSelectSchema(knowledgeCollections);
export const insertKnowledgeCollectionSchema = createInsertSchema(knowledgeCollections, {
  name: z.string().min(1).max(200),
  visibility: z.enum(["private", "team", "public"]).default("private"),
}).omit({ id: true, orgId: true, ownerId: true, createdAt: true, updatedAt: true, deletedAt: true, version: true, lastIndexedAt: true, status: true });

export type KnowledgeCollection = z.infer<typeof selectKnowledgeCollectionSchema>;
export type InsertKnowledgeCollection = z.infer<typeof insertKnowledgeCollectionSchema>;
