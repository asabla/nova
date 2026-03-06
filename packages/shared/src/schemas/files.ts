import { pgTable, text, uuid, timestamp, boolean, bigint, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  storagePath: text("storage_path").notNull(),
  storageBucket: text("storage_bucket").notNull(),
  checksumSha256: text("checksum_sha256"),
  isPublic: boolean("is_public").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_files_org_user").on(table.orgId, table.userId),
  index("idx_files_workspace").on(table.workspaceId),
  index("idx_files_org_active").on(table.orgId),
]);

export const fileChunks = pgTable("file_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_file_chunks_file_index").on(table.fileId, table.chunkIndex),
  index("idx_file_chunks_org_id").on(table.orgId),
]);

export const selectFileSchema = createSelectSchema(files);
export const insertFileSchema = createInsertSchema(files, {
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1),
}).omit({ id: true, orgId: true, userId: true, createdAt: true, updatedAt: true, deletedAt: true });

export type File = z.infer<typeof selectFileSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;
