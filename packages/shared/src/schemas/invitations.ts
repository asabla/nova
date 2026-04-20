import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organisations } from "./organisations.js";
import { users } from "./users.js";

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  groupIds: jsonb("group_ids"),
  invitedById: uuid("invited_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_invitations_org_id").on(table.orgId),
  index("idx_invitations_token_hash").on(table.tokenHash),
  index("idx_invitations_email").on(table.email),
  index("idx_invitations_expires_at").on(table.expiresAt),
]);

export type Invitation = typeof invitations.$inferSelect;
