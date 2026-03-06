import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { conversations } from "./conversations";
import { agents } from "./agents";

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  temporalWorkflowId: text("temporal_workflow_id").notNull(),
  temporalRunId: text("temporal_run_id"),
  type: text("type").notNull(),
  status: text("status").notNull().default("running"),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  initiatedById: uuid("initiated_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  input: jsonb("input"),
  output: jsonb("output"),
  errorMessage: text("error_message"),
  progress: jsonb("progress"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_workflows_org_id").on(table.orgId),
  index("idx_workflows_temporal_wf_id").on(table.temporalWorkflowId),
  index("idx_workflows_org_status").on(table.orgId, table.status),
]);

export const selectWorkflowSchema = createSelectSchema(workflows);
export type Workflow = z.infer<typeof selectWorkflowSchema>;
