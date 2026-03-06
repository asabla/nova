import { pgTable, text, uuid, timestamp, bigint, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  ssoGroupId: text("sso_group_id"),
  modelAccess: jsonb("model_access"),
  monthlyTokenLimit: bigint("monthly_token_limit", { mode: "number" }),
  monthlyCostLimitCents: integer("monthly_cost_limit_cents"),
  storageQuotaMb: integer("storage_quota_mb"),
  dataRetentionDays: integer("data_retention_days"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_groups_org_id").on(table.orgId),
  uniqueIndex("idx_groups_org_name").on(table.orgId, table.name),
]);

export const groupMemberships = pgTable("group_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("idx_group_memberships_group_user").on(table.groupId, table.userId),
  index("idx_group_memberships_org_id").on(table.orgId),
  index("idx_group_memberships_user_id").on(table.userId),
]);

export const selectGroupSchema = createSelectSchema(groups);
export const insertGroupSchema = createInsertSchema(groups, {
  name: z.string().min(1).max(200),
}).omit({ id: true, orgId: true, createdAt: true, updatedAt: true, deletedAt: true });
export const updateGroupSchema = insertGroupSchema.partial();

export type Group = z.infer<typeof selectGroupSchema>;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
