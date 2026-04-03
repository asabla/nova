import { pgTable, text, uuid, timestamp, jsonb, inet, index } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { organisations } from "./organisations";
import { users } from "./users";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organisations.id, { onDelete: "restrict" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorType: text("actor_type").notNull(),
  impersonatorId: uuid("impersonator_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id"),
  details: jsonb("details"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_audit_logs_org_created").on(table.orgId, table.createdAt),
  index("idx_audit_logs_actor_id").on(table.actorId),
  index("idx_audit_logs_resource").on(table.resourceType, table.resourceId),
  index("idx_audit_logs_action").on(table.action),
]);

export type AuditLog = typeof auditLogs.$inferSelect;
