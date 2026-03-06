import { pgTable, text, uuid, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";

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

export const selectMcpServerSchema = createSelectSchema(mcpServers);
export const insertMcpServerSchema = createInsertSchema(mcpServers, {
  name: z.string().min(1).max(200),
  url: z.string().url(),
  authType: z.enum(["none", "bearer", "api_key"]).optional(),
}).omit({ id: true, orgId: true, registeredById: true, createdAt: true, updatedAt: true, deletedAt: true, healthStatus: true, lastHealthCheckAt: true });

export type McpServer = z.infer<typeof selectMcpServerSchema>;
export type InsertMcpServer = z.infer<typeof insertMcpServerSchema>;
