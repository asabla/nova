CREATE TABLE "knowledge_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"knowledge_collection_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"provider" text NOT NULL,
	"tenant_id" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_encrypted" text NOT NULL,
	"resource_id" text NOT NULL,
	"resource_path" text,
	"resource_name" text,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"sync_interval_minutes" integer DEFAULT 360 NOT NULL,
	"folder_filter" text,
	"file_type_filter" jsonb,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" text DEFAULT 'pending' NOT NULL,
	"last_sync_error" text,
	"delta_cursor" text,
	"synced_document_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "connector_id" uuid;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "knowledge_connectors" ADD CONSTRAINT "knowledge_connectors_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_connectors" ADD CONSTRAINT "knowledge_connectors_knowledge_collection_id_knowledge_collections_id_fk" FOREIGN KEY ("knowledge_collection_id") REFERENCES "public"."knowledge_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_connectors" ADD CONSTRAINT "knowledge_connectors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_knowledge_connectors_org" ON "knowledge_connectors" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_connectors_collection" ON "knowledge_connectors" USING btree ("knowledge_collection_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_connectors_sync" ON "knowledge_connectors" USING btree ("sync_enabled","last_sync_at");--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_connector_id_knowledge_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."knowledge_connectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_knowledge_documents_connector_external" ON "knowledge_documents" USING btree ("connector_id","external_id");