import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organisations } from "./organisations.js";
import { messages } from "./messages.js";
import { conversations } from "./conversations.js";

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title"),
  content: text("content"),
  fileId: uuid("file_id"),
  language: text("language"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_artifacts_message_id").on(table.messageId),
  index("idx_artifacts_conversation_id").on(table.conversationId),
  index("idx_artifacts_org_id").on(table.orgId),
]);
