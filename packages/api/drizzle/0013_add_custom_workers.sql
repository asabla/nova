-- Custom workers table for extensible polyglot worker architecture
CREATE TABLE IF NOT EXISTS "custom_workers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "url" text NOT NULL,
  "workflow_types" jsonb NOT NULL DEFAULT '["agent"]',
  "auth_type" text NOT NULL DEFAULT 'hmac',
  "auth_secret_encrypted" text,
  "is_builtin" boolean NOT NULL DEFAULT false,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "health_status" text DEFAULT 'unknown',
  "last_health_check_at" timestamp with time zone,
  "timeout_seconds" integer NOT NULL DEFAULT 300,
  "fallback_to_builtin" boolean NOT NULL DEFAULT true,
  "registered_by_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
  "config" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_custom_workers_org_id" ON "custom_workers" ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_custom_workers_org_name" ON "custom_workers" ("org_id", "name");--> statement-breakpoint

-- Add custom_worker_id to agents table
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "custom_worker_id" uuid REFERENCES "custom_workers" ("id") ON DELETE SET NULL;
