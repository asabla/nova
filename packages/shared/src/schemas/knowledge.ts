import { pgTable, text, uuid, timestamp, integer, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organisations } from "./organisations";
import { users } from "./users";

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
  connectorId: uuid("connector_id").references(() => knowledgeConnectors.id, { onDelete: "set null" }),
  externalId: text("external_id"),
  sourceUrl: text("source_url"),
  title: text("title"),
  content: text("content"),
  status: text("status").notNull().default("pending"),
  metadata: jsonb("metadata"),
  summary: text("summary"),
  errorMessage: text("error_message"),
  tokenCount: integer("token_count"),
  chunkCount: integer("chunk_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_knowledge_documents_collection").on(table.knowledgeCollectionId),
  index("idx_knowledge_documents_org_id").on(table.orgId),
  index("idx_knowledge_documents_status").on(table.status),
  uniqueIndex("idx_knowledge_documents_connector_external").on(table.connectorId, table.externalId),
]);

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgeDocumentId: uuid("knowledge_document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  knowledgeCollectionId: uuid("knowledge_collection_id").notNull().references(() => knowledgeCollections.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
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

export const knowledgeTags = pgTable("knowledge_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_knowledge_tags_org_name").on(table.orgId, table.name),
]);

export const knowledgeDocumentTagAssignments = pgTable("knowledge_document_tag_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgeDocumentId: uuid("knowledge_document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  knowledgeTagId: uuid("knowledge_tag_id").notNull().references(() => knowledgeTags.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_knowledge_doc_tag_unique").on(table.knowledgeDocumentId, table.knowledgeTagId),
  index("idx_knowledge_doc_tag_doc").on(table.knowledgeDocumentId),
  index("idx_knowledge_doc_tag_tag").on(table.knowledgeTagId),
]);

// ── Knowledge Connectors (Microsoft 365: SharePoint, OneDrive, Teams) ──

export const knowledgeConnectors = pgTable("knowledge_connectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  knowledgeCollectionId: uuid("knowledge_collection_id").notNull().references(() => knowledgeCollections.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(), // 'sharepoint' | 'onedrive' | 'teams'

  // Azure AD app registration (per-connector)
  tenantId: text("tenant_id").notNull(),
  clientId: text("client_id").notNull(),
  clientSecretEncrypted: text("client_secret_encrypted").notNull(),

  // Source selection
  resourceId: text("resource_id").notNull(), // siteId, driveId, or teamId
  resourcePath: text("resource_path"), // e.g. "/Shared Documents/Reports" or channelId
  resourceName: text("resource_name"), // display name for UI

  // Sync config
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(360),
  folderFilter: text("folder_filter"),
  fileTypeFilter: jsonb("file_type_filter"), // string[] of MIME types

  // Sync state
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status").notNull().default("pending"),
  lastSyncError: text("last_sync_error"),
  deltaCursor: text("delta_cursor"),
  syncedDocumentCount: integer("synced_document_count").notNull().default(0),

  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_knowledge_connectors_org").on(table.orgId),
  index("idx_knowledge_connectors_collection").on(table.knowledgeCollectionId),
  index("idx_knowledge_connectors_sync").on(table.syncEnabled, table.lastSyncAt),
]);

export type KnowledgeConnector = typeof knowledgeConnectors.$inferSelect;
export type InsertKnowledgeConnector = typeof knowledgeConnectors.$inferInsert;

export type KnowledgeCollection = typeof knowledgeCollections.$inferSelect;
export type InsertKnowledgeCollection = typeof knowledgeCollections.$inferInsert;

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;

export type KnowledgeTag = typeof knowledgeTags.$inferSelect;
export type InsertKnowledgeTag = typeof knowledgeTags.$inferInsert;

export type KnowledgeDocumentTagAssignment = typeof knowledgeDocumentTagAssignments.$inferSelect;
