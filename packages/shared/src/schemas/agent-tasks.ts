import { pgTable, text, uuid, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";

export const agentTasks = pgTable("agent_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: text("workflow_id").notNull(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  parentTaskId: uuid("parent_task_id"),
  stepNumber: integer("step_number").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  parallelGroup: integer("parallel_group"),
  toolsUsed: jsonb("tools_used").$type<string[]>(),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_agent_tasks_workflow_id").on(table.workflowId),
  index("idx_agent_tasks_org_id").on(table.orgId),
  index("idx_agent_tasks_parent_task_id").on(table.parentTaskId),
]);

export const selectAgentTaskSchema = createSelectSchema(agentTasks);
export const insertAgentTaskSchema = createInsertSchema(agentTasks);
export type AgentTask = z.infer<typeof selectAgentTaskSchema>;
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
