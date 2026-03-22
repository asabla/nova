import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";

export const promptTemplates = pgTable("prompt_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  variables: jsonb("variables"),
  systemPrompt: text("system_prompt"),
  firstMessage: text("first_message"),
  category: text("category"),
  tags: jsonb("tags"),
  visibility: text("visibility").notNull().default("private"),
  isApproved: boolean("is_approved").notNull().default(false),
  currentVersion: integer("current_version").notNull().default(1),
  forkedFromTemplateId: uuid("forked_from_template_id"),
  usageCount: integer("usage_count").notNull().default(0),
  avgRating: numeric("avg_rating", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_prompt_templates_org_id").on(table.orgId),
  index("idx_prompt_templates_owner_id").on(table.ownerId),
  uniqueIndex("idx_prompt_templates_org_name").on(table.orgId, table.name),
]);

export const promptTemplateVersions = pgTable("prompt_template_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptTemplateId: uuid("prompt_template_id").notNull().references(() => promptTemplates.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  variables: jsonb("variables"),
  systemPrompt: text("system_prompt"),
  changelog: text("changelog"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_prompt_template_versions_org_id").on(table.orgId),
]);

export const selectPromptTemplateSchema = createSelectSchema(promptTemplates);
export const insertPromptTemplateSchema = createInsertSchema(promptTemplates, {
  name: z.string().min(1).max(200),
  content: z.string().min(1),
  visibility: z.enum(["private", "team", "org"]).default("private"),
}).omit({
  id: true, orgId: true, ownerId: true,
  createdAt: true, updatedAt: true, deletedAt: true,
  currentVersion: true, usageCount: true, avgRating: true, isApproved: true,
});

export type PromptTemplate = z.infer<typeof selectPromptTemplateSchema>;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
