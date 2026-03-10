import { pgTable, text, uuid, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { groups } from "./groups";
import { knowledgeCollections } from "./knowledge";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  defaultAgentId: uuid("default_agent_id"),
  defaultModelId: uuid("default_model_id"),
  defaultSystemPrompt: text("default_system_prompt"),
  knowledgeCollectionId: uuid("knowledge_collection_id").references(() => knowledgeCollections.id, { onDelete: "set null" }),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_workspaces_org_id").on(table.orgId),
  index("idx_workspaces_owner_id").on(table.ownerId),
]);

export const workspaceMemberships = pgTable("workspace_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_workspace_memberships_org_id").on(table.orgId),
]);

export const selectWorkspaceSchema = createSelectSchema(workspaces);
export const insertWorkspaceSchema = createInsertSchema(workspaces, {
  name: z.string().min(1).max(200),
}).omit({ id: true, orgId: true, ownerId: true, knowledgeCollectionId: true, createdAt: true, updatedAt: true, deletedAt: true });
export const updateWorkspaceSchema = insertWorkspaceSchema.partial();

export type Workspace = z.infer<typeof selectWorkspaceSchema>;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
