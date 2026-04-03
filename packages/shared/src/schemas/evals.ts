import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, numeric, index, uniqueIndex, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { messages } from "./messages";
import { conversations } from "./conversations";

// ---------------------------------------------------------------------------
// System Prompts — named prompt slots replacing hardcoded constants
// ---------------------------------------------------------------------------

export const systemPrompts = pgTable("system_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  activeVersionId: uuid("active_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_system_prompts_org_slug").on(table.orgId, table.slug),
  index("idx_system_prompts_org_id").on(table.orgId),
]);

export const systemPromptVersions = pgTable("system_prompt_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  systemPromptId: uuid("system_prompt_id").notNull().references(() => systemPrompts.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  generatedBy: text("generated_by").notNull().default("human"),
  generationContext: jsonb("generation_context"),
  status: text("status").notNull().default("draft"),
  trafficPct: integer("traffic_pct").notNull().default(0),
  evalCount: integer("eval_count").notNull().default(0),
  avgScore: numeric("avg_score", { precision: 5, scale: 4 }),
  approvedById: uuid("approved_by_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_system_prompt_versions_prompt_version").on(table.systemPromptId, table.version),
  index("idx_system_prompt_versions_org_id").on(table.orgId),
  index("idx_system_prompt_versions_status").on(table.orgId, table.status),
]);

// ---------------------------------------------------------------------------
// Eval Dimensions — configurable scoring rubrics per eval type
// ---------------------------------------------------------------------------

export const evalDimensions = pgTable("eval_dimensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  evalType: text("eval_type").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  weight: numeric("weight", { precision: 3, scale: 2 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_eval_dimensions_org_type_name").on(table.orgId, table.evalType, table.name),
  index("idx_eval_dimensions_org_type").on(table.orgId, table.evalType),
]);

// ---------------------------------------------------------------------------
// Eval Runs — one row per automated evaluation of an assistant message
// ---------------------------------------------------------------------------

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  evalType: text("eval_type").notNull(),
  executionTier: text("execution_tier"),
  scores: jsonb("scores"),
  overallScore: numeric("overall_score", { precision: 5, scale: 4 }),
  reasoning: text("reasoning"),
  judgeModel: text("judge_model"),
  promptVersionId: uuid("prompt_version_id").references(() => systemPromptVersions.id, { onDelete: "set null" }),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costCents: integer("cost_cents"),
  durationMs: integer("duration_ms"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_eval_runs_org_type_created").on(table.orgId, table.evalType, table.createdAt),
  index("idx_eval_runs_message_id").on(table.messageId),
  index("idx_eval_runs_prompt_version").on(table.promptVersionId),
  index("idx_eval_runs_org_status").on(table.orgId, table.status),
]);

// ---------------------------------------------------------------------------
// Eval Aggregates — pre-computed rollups for dashboard
// ---------------------------------------------------------------------------

export const evalAggregates = pgTable("eval_aggregates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  evalType: text("eval_type").notNull(),
  period: text("period").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  avgScore: numeric("avg_score", { precision: 5, scale: 4 }),
  medianScore: numeric("median_score", { precision: 5, scale: 4 }),
  evalCount: integer("eval_count").notNull().default(0),
  thumbsUpCount: integer("thumbs_up_count").notNull().default(0),
  thumbsDownCount: integer("thumbs_down_count").notNull().default(0),
  dimensionScores: jsonb("dimension_scores"),
  promptVersionId: uuid("prompt_version_id").references(() => systemPromptVersions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("uq_eval_aggregates").on(
    table.orgId, table.evalType, table.period, table.periodStart, table.promptVersionId
  ).nullsNotDistinct(),
  index("idx_eval_aggregates_org_type_period").on(table.orgId, table.evalType, table.period),
]);

// ---------------------------------------------------------------------------
// Prompt Optimization Runs — tracks self-improvement cycles
// ---------------------------------------------------------------------------

export const promptOptimizationRuns = pgTable("prompt_optimization_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  systemPromptId: uuid("system_prompt_id").notNull().references(() => systemPrompts.id, { onDelete: "cascade" }),
  triggerReason: text("trigger_reason").notNull(),
  triggerData: jsonb("trigger_data"),
  lowScoringMessageIds: jsonb("low_scoring_message_ids"),
  analysisReasoning: text("analysis_reasoning"),
  proposedVersionId: uuid("proposed_version_id").references(() => systemPromptVersions.id, { onDelete: "set null" }),
  status: text("status").notNull().default("analyzing"),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_prompt_optimization_runs_org_prompt").on(table.orgId, table.systemPromptId),
  index("idx_prompt_optimization_runs_status").on(table.orgId, table.status),
]);

// ---------------------------------------------------------------------------
// Zod schemas & types
// ---------------------------------------------------------------------------

export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = typeof systemPrompts.$inferInsert;
export type SystemPromptVersion = typeof systemPromptVersions.$inferSelect;
export type InsertSystemPromptVersion = typeof systemPromptVersions.$inferInsert;
export type EvalDimension = typeof evalDimensions.$inferSelect;
export type InsertEvalDimension = typeof evalDimensions.$inferInsert;
export type EvalRun = typeof evalRuns.$inferSelect;
export type InsertEvalRun = typeof evalRuns.$inferInsert;
export type EvalAggregate = typeof evalAggregates.$inferSelect;
export type PromptOptimizationRun = typeof promptOptimizationRuns.$inferSelect;
export type InsertPromptOptimizationRun = typeof promptOptimizationRuns.$inferInsert;
