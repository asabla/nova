import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";

export const modelProviders = pgTable("model_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  apiBaseUrl: text("api_base_url"),
  apiKeyEncrypted: text("api_key_encrypted"),
  litellmParams: jsonb("litellm_params"),
  providerParams: jsonb("provider_params"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_model_providers_org_id").on(table.orgId),
  uniqueIndex("idx_model_providers_org_name").on(table.orgId, table.name),
]);

export const models = pgTable("models", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  modelProviderId: uuid("model_provider_id").notNull().references(() => modelProviders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  modelIdExternal: text("model_id_external").notNull(),
  capabilities: jsonb("capabilities").notNull().default([]),
  contextWindow: integer("context_window"),
  costPerPromptTokenCents: numeric("cost_per_prompt_token_cents", { precision: 10, scale: 6 }),
  costPerCompletionTokenCents: numeric("cost_per_completion_token_cents", { precision: 10, scale: 6 }),
  modelParams: jsonb("model_params"),
  isDefault: boolean("is_default").notNull().default(false),
  isFallback: boolean("is_fallback").notNull().default(false),
  fallbackOrder: integer("fallback_order"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_models_org_id").on(table.orgId),
  index("idx_models_provider").on(table.modelProviderId),
  uniqueIndex("idx_models_org_external_id").on(table.orgId, table.modelIdExternal),
]);

export const selectModelProviderSchema = createSelectSchema(modelProviders);
export const insertModelProviderSchema = createInsertSchema(modelProviders, {
  name: z.string().min(1).max(200),
  type: z.enum(["openai", "anthropic", "azure", "ollama", "custom"]),
}).omit({ id: true, orgId: true, createdAt: true, updatedAt: true, deletedAt: true });

export const selectModelSchema = createSelectSchema(models);
export const insertModelSchema = createInsertSchema(models, {
  name: z.string().min(1).max(200),
  modelIdExternal: z.string().min(1),
}).omit({ id: true, orgId: true, createdAt: true, updatedAt: true, deletedAt: true });

export type ModelProvider = z.infer<typeof selectModelProviderSchema>;
export type Model = z.infer<typeof selectModelSchema>;
