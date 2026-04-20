import { pgTable, text, uuid, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { organisations } from "./organisations.js";
import { users } from "./users.js";
import { sessions } from "./users.js";

export const ssoProviders = pgTable("sso_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  providerName: text("provider_name").notNull(),
  clientId: text("client_id").notNull(),
  clientSecretEncrypted: text("client_secret_encrypted").notNull(),
  issuerUrl: text("issuer_url"),
  metadataUrl: text("metadata_url"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  autoProvisionUsers: boolean("auto_provision_users").notNull().default(false),
  defaultRole: text("default_role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_sso_providers_org_id").on(table.orgId),
]);

export const ssoSessions = pgTable("sso_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  ssoProviderId: uuid("sso_provider_id").notNull().references(() => ssoProviders.id, { onDelete: "restrict" }),
  externalUserId: text("external_user_id").notNull(),
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_sso_sessions_session_id").on(table.sessionId),
  index("idx_sso_sessions_provider_external").on(table.ssoProviderId, table.externalUserId),
]);
