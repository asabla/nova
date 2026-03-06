import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { messages } from "./messages";
import { conversations } from "./conversations";

export const tools = pgTable("tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  openapiSpec: jsonb("openapi_spec"),
  functionSchema: jsonb("function_schema").notNull(),
  isApproved: boolean("is_approved").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  registeredById: uuid("registered_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  currentVersion: integer("current_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_tools_org_id").on(table.orgId),
  uniqueIndex("idx_tools_org_name").on(table.orgId, table.name),
]);

export const toolVersions = pgTable("tool_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolId: uuid("tool_id").notNull().references(() => tools.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  functionSchema: jsonb("function_schema").notNull(),
  openapiSpec: jsonb("openapi_spec"),
  changelog: text("changelog"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_tool_versions_tool_version").on(table.toolId, table.version),
  index("idx_tool_versions_org_id").on(table.orgId),
]);

export const toolCalls = pgTable("tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  toolId: uuid("tool_id").references(() => tools.id, { onDelete: "set null" }),
  mcpToolId: uuid("mcp_tool_id"),
  toolName: text("tool_name").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  status: text("status").notNull().default("pending"),
  approvedById: uuid("approved_by_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_tool_calls_message_id").on(table.messageId),
  index("idx_tool_calls_conversation_id").on(table.conversationId),
  index("idx_tool_calls_org_id").on(table.orgId),
]);

export const selectToolSchema = createSelectSchema(tools);
export const insertToolSchema = createInsertSchema(tools, {
  name: z.string().min(1).max(200),
  type: z.enum(["builtin", "openapi", "custom"]),
}).omit({ id: true, orgId: true, registeredById: true, createdAt: true, updatedAt: true, deletedAt: true, currentVersion: true });

export type Tool = z.infer<typeof selectToolSchema>;
export type InsertTool = z.infer<typeof insertToolSchema>;
