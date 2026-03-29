ALTER TABLE "conversation_folders" ADD COLUMN "default_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "memory_limit_mb" integer;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "approved_by_id" uuid;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "conversation_folders" ADD CONSTRAINT "conversation_folders_default_agent_id_agents_id_fk" FOREIGN KEY ("default_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;