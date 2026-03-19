CREATE TABLE "knowledge_document_tag_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_document_id" uuid NOT NULL,
	"knowledge_tag_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "knowledge_document_tag_assignments" ADD CONSTRAINT "knowledge_document_tag_assignments_knowledge_document_id_knowledge_documents_id_fk" FOREIGN KEY ("knowledge_document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_tag_assignments" ADD CONSTRAINT "knowledge_document_tag_assignments_knowledge_tag_id_knowledge_tags_id_fk" FOREIGN KEY ("knowledge_tag_id") REFERENCES "public"."knowledge_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_tag_assignments" ADD CONSTRAINT "knowledge_document_tag_assignments_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_tags" ADD CONSTRAINT "knowledge_tags_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_knowledge_doc_tag_unique" ON "knowledge_document_tag_assignments" USING btree ("knowledge_document_id","knowledge_tag_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_doc_tag_doc" ON "knowledge_document_tag_assignments" USING btree ("knowledge_document_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_doc_tag_tag" ON "knowledge_document_tag_assignments" USING btree ("knowledge_tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_knowledge_tags_org_name" ON "knowledge_tags" USING btree ("org_id","name");