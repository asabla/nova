CREATE TABLE "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"step_number" integer NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"parallel_group" integer,
	"tools_used" jsonb,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memory_vectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"scope" text DEFAULT 'global' NOT NULL,
	"content" text NOT NULL,
	"embedding" vector,
	"metadata" jsonb,
	"source_type" text,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_vectors" ADD CONSTRAINT "agent_memory_vectors_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_vectors" ADD CONSTRAINT "agent_memory_vectors_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_vectors" ADD CONSTRAINT "agent_memory_vectors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_tasks_workflow_id" ON "agent_tasks" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_agent_tasks_org_id" ON "agent_tasks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_agent_tasks_parent_task_id" ON "agent_tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_vectors_agent_id" ON "agent_memory_vectors" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_vectors_org_id" ON "agent_memory_vectors" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_vectors_user_id" ON "agent_memory_vectors" USING btree ("user_id");