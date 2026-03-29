import { pgTable, text, uuid, timestamp, boolean, bigint, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { knowledgeCollections } from "./knowledge";
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  title: text("title"),
  visibility: text("visibility").notNull().default("private"),
  modelId: uuid("model_id"),
  systemPrompt: text("system_prompt"),
  modelParams: jsonb("model_params"),
  isPinned: boolean("is_pinned").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  forkedFromMessageId: uuid("forked_from_message_id"),
  publicShareToken: text("public_share_token"),
  totalTokens: bigint("total_tokens", { mode: "number" }).notNull().default(0),
  estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_conversations_org_owner").on(table.orgId, table.ownerId),
  uniqueIndex("idx_conversations_share_token").on(table.publicShareToken),
  index("idx_conversations_org_active").on(table.orgId),
  index("idx_conversations_org_deleted").on(table.orgId, table.deletedAt),
  index("idx_conversations_org_archived").on(table.orgId, table.isArchived, table.updatedAt),
]);

export const conversationParticipants = pgTable("conversation_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("participant"),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_conversation_participants_conv_user").on(table.conversationId, table.userId),
  index("idx_conversation_participants_org_id").on(table.orgId),
]);

export const conversationFolders = pgTable("conversation_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentFolderId: uuid("parent_folder_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_conversation_folders_org_user").on(table.orgId, table.userId),
]);

export const conversationTags = pgTable("conversation_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_conversation_tags_org_user_name").on(table.orgId, table.userId, table.name),
]);

export const conversationTagAssignments = pgTable("conversation_tag_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  conversationTagId: uuid("conversation_tag_id").references(() => conversationTags.id, { onDelete: "cascade" }),
  conversationFolderId: uuid("conversation_folder_id").references(() => conversationFolders.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_conversation_tag_assignments_conv").on(table.conversationId),
  index("idx_conversation_tag_assignments_org").on(table.orgId),
]);

export const conversationKnowledgeCollections = pgTable("conversation_knowledge_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  knowledgeCollectionId: uuid("knowledge_collection_id").notNull().references(() => knowledgeCollections.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_conv_knowledge_collections_conv").on(table.conversationId),
  index("idx_conv_knowledge_collections_org").on(table.orgId),
  uniqueIndex("idx_conv_knowledge_collections_conv_coll").on(table.conversationId, table.knowledgeCollectionId),
]);

export const selectConversationSchema = createSelectSchema(conversations);
export const insertConversationSchema = createInsertSchema(conversations, {
  title: z.string().min(1).max(500).optional(),
  systemPrompt: z.string().max(10_000).optional(),
  visibility: z.enum(["private", "team", "public"]).default("private"),
}).omit({
  id: true, orgId: true, ownerId: true,
  createdAt: true, updatedAt: true, deletedAt: true,
  totalTokens: true, estimatedCostCents: true,
});
export const updateConversationSchema = insertConversationSchema.partial();

export type Conversation = z.infer<typeof selectConversationSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
