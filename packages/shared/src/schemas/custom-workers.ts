import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";

export const customWorkers = pgTable("custom_workers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  workflowTypes: jsonb("workflow_types").$type<string[]>().notNull().default(["agent"]),
  authType: text("auth_type").notNull().default("hmac"),
  authSecretEncrypted: text("auth_secret_encrypted"),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  healthStatus: text("health_status").default("unknown"),
  lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
  timeoutSeconds: integer("timeout_seconds").notNull().default(300),
  fallbackToBuiltin: boolean("fallback_to_builtin").notNull().default(true),
  registeredById: uuid("registered_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_custom_workers_org_id").on(table.orgId),
  uniqueIndex("idx_custom_workers_org_name").on(table.orgId, table.name),
]);

export const insertCustomWorkerSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullish(),
  url: z.string().url(),
  workflowTypes: z.array(z.string()).min(1),
  authType: z.enum(["hmac", "bearer", "mtls"]).default("hmac"),
  authSecretEncrypted: z.string().nullish(),
  isEnabled: z.boolean().default(true),
  timeoutSeconds: z.number().int().min(10).max(3600).default(300),
  fallbackToBuiltin: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
});
export const updateCustomWorkerSchema = insertCustomWorkerSchema.partial();

export type CustomWorker = typeof customWorkers.$inferSelect;
export type InsertCustomWorker = typeof customWorkers.$inferInsert;
