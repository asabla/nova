ALTER TABLE "workspace_memberships" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspaces" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "workspace_memberships" CASCADE;--> statement-breakpoint
DROP TABLE "workspaces" CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "files_workspace_id_workspaces_id_fk";
--> statement-breakpoint
DROP INDEX "idx_conversations_workspace";--> statement-breakpoint
DROP INDEX "idx_files_workspace";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "workspace_id";