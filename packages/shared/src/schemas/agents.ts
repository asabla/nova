import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { conversations } from "./conversations";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  systemPrompt: text("system_prompt"),
  modelId: uuid("model_id"),
  modelParams: jsonb("model_params"),
  visibility: text("visibility").notNull().default("private"),
  isPublished: boolean("is_published").notNull().default(false),
  toolApprovalMode: text("tool_approval_mode").notNull().default("always-ask"),
  memoryScope: text("memory_scope").notNull().default("per-user"),
  maxSteps: integer("max_steps"),
  timeoutSeconds: integer("timeout_seconds"),
  webhookUrl: text("webhook_url"),
  cronSchedule: text("cron_schedule"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  builtinTools: jsonb("builtin_tools").$type<string[]>(),
  starters: jsonb("starters").$type<string[]>(),
  clonedFromAgentId: uuid("cloned_from_agent_id"),
  currentVersion: integer("current_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_agents_org_id").on(table.orgId),
  index("idx_agents_owner_id").on(table.ownerId),
  index("idx_agents_org_active").on(table.orgId),
  uniqueIndex("idx_agents_org_name").on(table.orgId, table.name),
]);

export const agentVersions = pgTable("agent_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  systemPrompt: text("system_prompt"),
  modelId: uuid("model_id"),
  modelParams: jsonb("model_params"),
  configSnapshot: jsonb("config_snapshot").notNull(),
  changelog: text("changelog"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_agent_versions_agent_version").on(table.agentId, table.version),
  index("idx_agent_versions_org_id").on(table.orgId),
]);

export const agentSkills = pgTable("agent_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  skillName: text("skill_name").notNull(),
  config: jsonb("config"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_agent_skills_agent_skill").on(table.agentId, table.skillName),
  index("idx_agent_skills_org_id").on(table.orgId),
]);

export const agentTools = pgTable("agent_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  toolId: uuid("tool_id").notNull(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  configOverrides: jsonb("config_overrides"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_agent_tools_agent_tool").on(table.agentId, table.toolId),
  index("idx_agent_tools_org_id").on(table.orgId),
]);

export const agentMcpServers = pgTable("agent_mcp_servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  mcpServerId: uuid("mcp_server_id").notNull(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_agent_mcp_servers_agent_mcp").on(table.agentId, table.mcpServerId),
  index("idx_agent_mcp_servers_org_id").on(table.orgId),
]);

export const agentMemoryEntries = pgTable("agent_memory_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_agent_memory_agent_scope").on(table.agentId, table.scope),
  index("idx_agent_memory_org_id").on(table.orgId),
]);

export const agentKnowledgeCollections = pgTable("agent_knowledge_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  knowledgeCollectionId: uuid("knowledge_collection_id").notNull(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_agent_knowledge_collections_org_id").on(table.orgId),
]);

export const selectAgentSchema = createSelectSchema(agents);
export const insertAgentSchema = createInsertSchema(agents, {
  name: z.string().min(1).max(200),
  visibility: z.enum(["private", "team", "org", "public"]).default("private"),
  toolApprovalMode: z.enum(["auto", "always-ask", "never"]).default("always-ask"),
  memoryScope: z.enum(["per-user", "per-conversation", "global"]).default("per-user"),
}).omit({
  id: true, orgId: true, ownerId: true,
  createdAt: true, updatedAt: true, deletedAt: true,
  currentVersion: true,
});
export const updateAgentSchema = insertAgentSchema.partial();

export type Agent = z.infer<typeof selectAgentSchema>;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
