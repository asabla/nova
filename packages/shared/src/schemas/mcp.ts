import { pgTable, text, uuid, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organisations } from "./organisations.js";
import { users } from "./users.js";

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  authType: text("auth_type"),
  authTokenEncrypted: text("auth_token_encrypted"),
  isApproved: boolean("is_approved").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  healthStatus: text("health_status"),
  lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
  registeredById: uuid("registered_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_mcp_servers_org_id").on(table.orgId),
  uniqueIndex("idx_mcp_servers_org_url").on(table.orgId, table.url),
]);

export const mcpTools = pgTable("mcp_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  mcpServerId: uuid("mcp_server_id").notNull().references(() => mcpServers.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  inputSchema: jsonb("input_schema"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_mcp_tools_server_name").on(table.mcpServerId, table.name),
  index("idx_mcp_tools_org_id").on(table.orgId),
]);

export const mcpServerWhitelist = pgTable("mcp_server_whitelist", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  urlPattern: text("url_pattern").notNull(),
  description: text("description"),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_mcp_server_whitelist_org_id").on(table.orgId),
  uniqueIndex("idx_mcp_server_whitelist_org_pattern").on(table.orgId, table.urlPattern),
]);

export type McpServer = typeof mcpServers.$inferSelect;
export type InsertMcpServer = typeof mcpServers.$inferInsert;
