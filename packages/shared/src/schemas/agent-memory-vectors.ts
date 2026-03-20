import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { agents } from "./agents";

export const agentMemoryVectors = pgTable("agent_memory_vectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  scope: text("scope").notNull().default("global"),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  sourceType: text("source_type"), // "conversation", "manual", "extracted"
  sourceId: text("source_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_agent_memory_vectors_agent_id").on(table.agentId),
  index("idx_agent_memory_vectors_org_id").on(table.orgId),
  index("idx_agent_memory_vectors_user_id").on(table.userId),
]);

export const selectAgentMemoryVectorSchema = createSelectSchema(agentMemoryVectors);
export const insertAgentMemoryVectorSchema = createInsertSchema(agentMemoryVectors);
export type AgentMemoryVector = z.infer<typeof selectAgentMemoryVectorSchema>;
export type InsertAgentMemoryVector = z.infer<typeof insertAgentMemoryVectorSchema>;
