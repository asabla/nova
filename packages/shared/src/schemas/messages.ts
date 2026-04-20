import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, smallint, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organisations } from "./organisations.js";
import { users } from "./users.js";
import { conversations } from "./conversations.js";

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  parentMessageId: uuid("parent_message_id"),
  senderType: text("sender_type").notNull(),
  senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  agentId: uuid("agent_id"),
  modelId: uuid("model_id"),
  content: text("content"),
  contentType: text("content_type").notNull().default("text"),
  metadata: jsonb("metadata"),
  tokenCountPrompt: integer("token_count_prompt"),
  tokenCountCompletion: integer("token_count_completion"),
  costCents: integer("cost_cents"),
  isEdited: boolean("is_edited").notNull().default(false),
  editHistory: jsonb("edit_history"),
  status: text("status").notNull().default("completed"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_messages_conversation_created").on(table.conversationId, table.createdAt),
  index("idx_messages_org_id").on(table.orgId),
  index("idx_messages_parent").on(table.parentMessageId),
  index("idx_messages_active").on(table.conversationId, table.createdAt),
  index("idx_messages_status").on(table.status),
]);

export const messageAttachments = pgTable("message_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  fileId: uuid("file_id"),
  url: text("url"),
  urlTitle: text("url_title"),
  urlPreview: jsonb("url_preview"),
  attachmentType: text("attachment_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_message_attachments_message_id").on(table.messageId),
  index("idx_message_attachments_org_id").on(table.orgId),
]);

export const messageRatings = pgTable("message_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  rating: smallint("rating").notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_message_ratings_message_user").on(table.messageId, table.userId),
  index("idx_message_ratings_org_id").on(table.orgId),
]);

export const messageNotes = pgTable("message_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_message_notes_message_user").on(table.messageId, table.userId),
  index("idx_message_notes_org_id").on(table.orgId),
]);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
