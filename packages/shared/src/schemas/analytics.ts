import { pgTable, text, uuid, timestamp, bigint, integer, index, unique } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { groups } from "./groups";

export const usageStats = pgTable("usage_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  modelId: uuid("model_id"),
  period: text("period").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  promptTokens: bigint("prompt_tokens", { mode: "number" }).notNull().default(0),
  completionTokens: bigint("completion_tokens", { mode: "number" }).notNull().default(0),
  totalTokens: bigint("total_tokens", { mode: "number" }).notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  requestCount: integer("request_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  avgLatencyMs: integer("avg_latency_ms"),
  storageBytes: bigint("storage_bytes", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_usage_stats_org_period").on(table.orgId, table.period, table.periodStart),
  index("idx_usage_stats_user_period").on(table.userId, table.period),
  unique("uq_usage_stats_daily").on(table.orgId, table.userId, table.groupId, table.modelId, table.period, table.periodStart).nullsNotDistinct(),
]);

export type UsageStats = typeof usageStats.$inferSelect;
