import { pgTable, text, uuid, timestamp, integer, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { organisations } from "./organisations";
import { users } from "./users";
import { files } from "./files";

export const systemHealthChecks = pgTable("system_health_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  service: text("service").notNull(),
  status: text("status").notNull(),
  responseTimeMs: integer("response_time_ms"),
  details: jsonb("details"),
  checkedById: uuid("checked_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_system_health_checks_service_created").on(table.service),
]);

export const contentFilters = pgTable("content_filters", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  pattern: text("pattern"),
  action: text("action").notNull(),
  severity: text("severity").notNull().default("medium"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_content_filters_org_id").on(table.orgId),
]);

export const dlpRules = pgTable("dlp_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  detectorType: text("detector_type").notNull(),
  pattern: text("pattern"),
  keywords: jsonb("keywords"),
  action: text("action").notNull(),
  appliesTo: text("applies_to").notNull().default("both"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_dlp_rules_org_id").on(table.orgId),
]);

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").notNull(),
  credentialsEncrypted: text("credentials_encrypted"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  status: text("status").notNull().default("active"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  configuredById: uuid("configured_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_integrations_org_id").on(table.orgId),
]);

export const userKeyboardShortcuts = pgTable("user_keyboard_shortcuts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  keybinding: text("keybinding").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const dataJobs = pgTable("data_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  sourceFileId: uuid("source_file_id").references(() => files.id, { onDelete: "set null" }),
  resultFileId: uuid("result_file_id").references(() => files.id, { onDelete: "set null" }),
  progressPct: integer("progress_pct"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  workflowId: uuid("workflow_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_data_jobs_org_user").on(table.orgId, table.userId),
]);

export const rateLimitRules = pgTable("rate_limit_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  targetId: uuid("target_id"),
  windowSeconds: integer("window_seconds").notNull(),
  maxRequests: integer("max_requests").notNull(),
  maxTokens: bigint("max_tokens", { mode: "number" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_rate_limit_rules_org_scope").on(table.orgId, table.scope),
]);

export const researchReports = pgTable("research_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull(),
  workflowId: uuid("workflow_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  query: text("query").notNull(),
  config: jsonb("config"),
  reportContent: text("report_content"),
  sources: jsonb("sources"),
  status: text("status").notNull().default("running"),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_research_reports_org_id").on(table.orgId),
]);
