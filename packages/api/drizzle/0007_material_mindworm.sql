CREATE TABLE "research_report_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"refinement_prompt" text,
	"parent_version_id" uuid,
	"report_content" text,
	"sources" jsonb,
	"status" text DEFAULT 'running' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_reports" ADD COLUMN "current_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "research_report_versions" ADD CONSTRAINT "research_report_versions_report_id_research_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."research_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_report_versions_report_id" ON "research_report_versions" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_report_versions_report_version" ON "research_report_versions" USING btree ("report_id","version");