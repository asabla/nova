DROP INDEX "idx_audit_logs_org_created";--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "starters" jsonb;--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_conversations_org_deleted" ON "conversations" USING btree ("org_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_conversations_org_archived" ON "conversations" USING btree ("org_id","is_archived","updated_at");--> statement-breakpoint
CREATE INDEX "idx_files_orphan_cleanup" ON "files" USING btree ("size_bytes","created_at");--> statement-breakpoint
CREATE INDEX "idx_invitations_expires_at" ON "invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_created" ON "audit_logs" USING btree ("org_id","created_at");