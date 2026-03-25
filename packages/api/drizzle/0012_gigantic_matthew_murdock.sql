CREATE TABLE "agent_starter_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"prompt_template_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD COLUMN "inputs" jsonb;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD COLUMN "bg_color" text;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_starter_templates" ADD CONSTRAINT "agent_starter_templates_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_starter_templates" ADD CONSTRAINT "agent_starter_templates_prompt_template_id_prompt_templates_id_fk" FOREIGN KEY ("prompt_template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_starter_templates" ADD CONSTRAINT "agent_starter_templates_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_starter_templates_agent_template" ON "agent_starter_templates" USING btree ("agent_id","prompt_template_id");--> statement-breakpoint
CREATE INDEX "idx_agent_starter_templates_org_id" ON "agent_starter_templates" USING btree ("org_id");