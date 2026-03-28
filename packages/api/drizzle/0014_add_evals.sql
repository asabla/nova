-- Eval system: system prompts, versioned prompts, eval dimensions, eval runs, aggregates, prompt optimization

-- System prompts — named prompt slots replacing hardcoded constants
CREATE TABLE IF NOT EXISTS "system_prompts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations" ("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "active_version_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_system_prompts_org_slug" ON "system_prompts" ("org_id", "slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_system_prompts_org_id" ON "system_prompts" ("org_id");--> statement-breakpoint

-- System prompt versions — immutable versioned prompt content
CREATE TABLE IF NOT EXISTS "system_prompt_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "system_prompt_id" uuid NOT NULL REFERENCES "system_prompts" ("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organisations" ("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "content" text NOT NULL,
  "generated_by" text NOT NULL DEFAULT 'human',
  "generation_context" jsonb,
  "status" text NOT NULL DEFAULT 'draft',
  "traffic_pct" integer NOT NULL DEFAULT 0,
  "eval_count" integer NOT NULL DEFAULT 0,
  "avg_score" numeric(5, 4),
  "approved_by_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_system_prompt_versions_prompt_version" ON "system_prompt_versions" ("system_prompt_id", "version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_system_prompt_versions_org_id" ON "system_prompt_versions" ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_system_prompt_versions_status" ON "system_prompt_versions" ("org_id", "status");--> statement-breakpoint

-- Add FK from system_prompts.active_version_id to system_prompt_versions now that both tables exist
ALTER TABLE "system_prompts" ADD CONSTRAINT "fk_system_prompts_active_version" FOREIGN KEY ("active_version_id") REFERENCES "system_prompt_versions" ("id") ON DELETE SET NULL;--> statement-breakpoint

-- Eval dimensions — configurable scoring rubrics per eval type
CREATE TABLE IF NOT EXISTS "eval_dimensions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations" ("id") ON DELETE CASCADE,
  "eval_type" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "weight" numeric(3, 2) NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_eval_dimensions_org_type_name" ON "eval_dimensions" ("org_id", "eval_type", "name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_eval_dimensions_org_type" ON "eval_dimensions" ("org_id", "eval_type");--> statement-breakpoint

-- Eval runs — one row per automated evaluation of an assistant message
CREATE TABLE IF NOT EXISTS "eval_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations" ("id") ON DELETE CASCADE,
  "message_id" uuid NOT NULL REFERENCES "messages" ("id") ON DELETE CASCADE,
  "conversation_id" uuid NOT NULL REFERENCES "conversations" ("id") ON DELETE CASCADE,
  "eval_type" text NOT NULL,
  "execution_tier" text,
  "scores" jsonb,
  "overall_score" numeric(5, 4),
  "reasoning" text,
  "judge_model" text,
  "prompt_version_id" uuid REFERENCES "system_prompt_versions" ("id") ON DELETE SET NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "cost_cents" integer,
  "duration_ms" integer,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_eval_runs_org_type_created" ON "eval_runs" ("org_id", "eval_type", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_eval_runs_message_id" ON "eval_runs" ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_eval_runs_prompt_version" ON "eval_runs" ("prompt_version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_eval_runs_org_status" ON "eval_runs" ("org_id", "status");--> statement-breakpoint

-- Eval aggregates — pre-computed rollups for dashboard
CREATE TABLE IF NOT EXISTS "eval_aggregates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations" ("id") ON DELETE CASCADE,
  "eval_type" text NOT NULL,
  "period" text NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "avg_score" numeric(5, 4),
  "median_score" numeric(5, 4),
  "eval_count" integer NOT NULL DEFAULT 0,
  "thumbs_up_count" integer NOT NULL DEFAULT 0,
  "thumbs_down_count" integer NOT NULL DEFAULT 0,
  "dimension_scores" jsonb,
  "prompt_version_id" uuid REFERENCES "system_prompt_versions" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_eval_aggregates" ON "eval_aggregates" ("org_id", "eval_type", "period", "period_start", COALESCE("prompt_version_id", '00000000-0000-0000-0000-000000000000'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_eval_aggregates_org_type_period" ON "eval_aggregates" ("org_id", "eval_type", "period");--> statement-breakpoint

-- Prompt optimization runs — tracks self-improvement cycles
CREATE TABLE IF NOT EXISTS "prompt_optimization_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations" ("id") ON DELETE CASCADE,
  "system_prompt_id" uuid NOT NULL REFERENCES "system_prompts" ("id") ON DELETE CASCADE,
  "trigger_reason" text NOT NULL,
  "trigger_data" jsonb,
  "low_scoring_message_ids" jsonb,
  "analysis_reasoning" text,
  "proposed_version_id" uuid REFERENCES "system_prompt_versions" ("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'analyzing',
  "model" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_prompt_optimization_runs_org_prompt" ON "prompt_optimization_runs" ("org_id", "system_prompt_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prompt_optimization_runs_status" ON "prompt_optimization_runs" ("org_id", "status");
