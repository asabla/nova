import { pgTable, text, uuid, timestamp, integer, bigint, index } from "drizzle-orm/pg-core";
import { organisations } from "./organisations.js";
import { messages } from "./messages.js";

export const sandboxExecutions = pgTable("sandbox_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  toolCallId: uuid("tool_call_id"),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  language: text("language").notNull(),
  code: text("code").notNull(),
  stdout: text("stdout"),
  stderr: text("stderr"),
  exitCode: integer("exit_code"),
  durationMs: integer("duration_ms"),
  memoryUsedBytes: bigint("memory_used_bytes", { mode: "number" }),
  sandboxBackend: text("sandbox_backend").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_sandbox_executions_org_id").on(table.orgId),
]);
