CREATE TABLE "org_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"logo_url" text,
	"favicon_url" text,
	"primary_color" text,
	"custom_css" text,
	"billing_plan" text,
	"billing_customer_id" text,
	"is_saas" boolean DEFAULT false NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"secret_encrypted" text NOT NULL,
	"label" text,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"timezone" text DEFAULT 'UTC',
	"locale" text DEFAULT 'en',
	"theme" text DEFAULT 'system',
	"font_size" text DEFAULT 'medium',
	"role" text DEFAULT 'member' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"password_changed_at" timestamp with time zone,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sso_group_id" text,
	"model_access" jsonb,
	"monthly_token_limit" bigint,
	"monthly_cost_limit_cents" integer,
	"storage_quota_mb" integer,
	"data_retention_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"group_id" uuid,
	"org_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"default_agent_id" uuid,
	"default_model_id" uuid,
	"default_system_prompt" text,
	"knowledge_collection_id" uuid,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_folder_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" text DEFAULT 'participant' NOT NULL,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_tag_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"conversation_tag_id" uuid,
	"conversation_folder_id" uuid,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid,
	"owner_id" uuid NOT NULL,
	"title" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"model_id" uuid,
	"system_prompt" text,
	"model_params" jsonb,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"forked_from_message_id" uuid,
	"public_share_token" text,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"file_id" uuid,
	"url" text,
	"url_title" text,
	"url_preview" jsonb,
	"attachment_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"parent_message_id" uuid,
	"sender_type" text NOT NULL,
	"sender_user_id" uuid,
	"agent_id" uuid,
	"model_id" uuid,
	"content" text,
	"content_type" text DEFAULT 'text' NOT NULL,
	"metadata" jsonb,
	"token_count_prompt" integer,
	"token_count_completion" integer,
	"cost_cents" integer,
	"is_edited" boolean DEFAULT false NOT NULL,
	"edit_history" jsonb,
	"status" text DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "file_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"storage_path" text NOT NULL,
	"storage_bucket" text NOT NULL,
	"checksum_sha256" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "model_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"api_base_url" text,
	"api_key_encrypted" text,
	"litellm_params" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"model_provider_id" uuid NOT NULL,
	"name" text NOT NULL,
	"model_id_external" text NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_window" integer,
	"cost_per_prompt_token_cents" numeric(10, 6),
	"cost_per_completion_token_cents" numeric(10, 6),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_fallback" boolean DEFAULT false NOT NULL,
	"fallback_order" integer,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_knowledge_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"knowledge_collection_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_memory_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"skill_name" text NOT NULL,
	"config" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"config_overrides" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"system_prompt" text,
	"model_id" uuid,
	"model_params" jsonb,
	"config_snapshot" jsonb NOT NULL,
	"changelog" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"avatar_url" text,
	"system_prompt" text,
	"model_id" uuid,
	"model_params" jsonb,
	"visibility" text DEFAULT 'private' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"tool_approval_mode" text DEFAULT 'always-ask' NOT NULL,
	"memory_scope" text DEFAULT 'per-user' NOT NULL,
	"max_steps" integer,
	"timeout_seconds" integer,
	"webhook_url" text,
	"cron_schedule" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"cloned_from_agent_id" uuid,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_document_id" uuid NOT NULL,
	"knowledge_collection_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector,
	"token_count" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"embedding_model_id" uuid,
	"embedding_model" text,
	"chunk_size" integer DEFAULT 512 NOT NULL,
	"chunk_overlap" integer DEFAULT 64 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_indexed_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_collection_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"file_id" uuid,
	"source_url" text,
	"title" text,
	"content" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"token_count" integer,
	"chunk_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"tool_id" uuid,
	"mcp_tool_id" uuid,
	"tool_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"duration_ms" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tool_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"function_schema" jsonb NOT NULL,
	"openapi_spec" jsonb,
	"changelog" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"openapi_spec" jsonb,
	"function_schema" jsonb NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"registered_by_id" uuid NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mcp_server_whitelist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"url_pattern" text NOT NULL,
	"description" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"auth_type" text,
	"auth_token_encrypted" text,
	"is_approved" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"health_status" text,
	"last_health_check_at" timestamp with time zone,
	"registered_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mcp_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"input_schema" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"notification_type" text NOT NULL,
	"channel" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"resource_type" text,
	"resource_id" uuid,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prompt_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_template_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"variables" jsonb,
	"system_prompt" text,
	"changelog" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"variables" jsonb,
	"system_prompt" text,
	"first_message" text,
	"category" text,
	"tags" jsonb,
	"visibility" text DEFAULT 'private' NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"forked_from_template_id" uuid,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"avg_rating" numeric(3, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usage_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"group_id" uuid,
	"model_id" uuid,
	"period" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"prompt_tokens" bigint DEFAULT 0 NOT NULL,
	"completion_tokens" bigint DEFAULT 0 NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"avg_latency_ms" integer,
	"storage_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"impersonator_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"details" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"temporal_workflow_id" text NOT NULL,
	"temporal_run_id" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"conversation_id" uuid,
	"agent_id" uuid,
	"initiated_by_id" uuid NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error_message" text,
	"progress" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sso_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider_name" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_encrypted" text NOT NULL,
	"issuer_url" text,
	"metadata_url" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"auto_provision_users" boolean DEFAULT false NOT NULL,
	"default_role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sso_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sso_provider_id" uuid NOT NULL,
	"external_user_id" text NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sandbox_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tool_call_id" uuid,
	"message_id" uuid,
	"language" text NOT NULL,
	"code" text NOT NULL,
	"stdout" text,
	"stderr" text,
	"exit_code" integer,
	"duration_ms" integer,
	"memory_used_bytes" bigint,
	"sandbox_backend" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"content" text,
	"file_id" uuid,
	"language" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"group_ids" jsonb,
	"invited_by_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"pattern" text,
	"action" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "data_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_file_id" uuid,
	"result_file_id" uuid,
	"progress_pct" integer,
	"error_message" text,
	"metadata" jsonb,
	"workflow_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dlp_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"detector_type" text NOT NULL,
	"pattern" text,
	"keywords" jsonb,
	"action" text NOT NULL,
	"applies_to" text DEFAULT 'both' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "domain_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"type" text NOT NULL,
	"reason" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"credentials_encrypted" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"configured_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limit_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"target_id" uuid,
	"window_seconds" integer NOT NULL,
	"max_requests" integer NOT NULL,
	"max_tokens" bigint,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "research_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"config" jsonb,
	"report_content" text,
	"sources" jsonb,
	"status" text DEFAULT 'running' NOT NULL,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system_health_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" text NOT NULL,
	"status" text NOT NULL,
	"response_time_ms" integer,
	"details" jsonb,
	"checked_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_keyboard_shortcuts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"action" text NOT NULL,
	"keybinding" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_credentials" ADD CONSTRAINT "mfa_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_knowledge_collection_id_knowledge_collections_id_fk" FOREIGN KEY ("knowledge_collection_id") REFERENCES "public"."knowledge_collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_folders" ADD CONSTRAINT "conversation_folders_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_folders" ADD CONSTRAINT "conversation_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_tag_assignments" ADD CONSTRAINT "conversation_tag_assignments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_tag_assignments" ADD CONSTRAINT "conversation_tag_assignments_conversation_tag_id_conversation_tags_id_fk" FOREIGN KEY ("conversation_tag_id") REFERENCES "public"."conversation_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_tag_assignments" ADD CONSTRAINT "conversation_tag_assignments_conversation_folder_id_conversation_folders_id_fk" FOREIGN KEY ("conversation_folder_id") REFERENCES "public"."conversation_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_tag_assignments" ADD CONSTRAINT "conversation_tag_assignments_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_notes" ADD CONSTRAINT "message_notes_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_notes" ADD CONSTRAINT "message_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_notes" ADD CONSTRAINT "message_notes_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_providers" ADD CONSTRAINT "model_providers_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_model_provider_id_model_providers_id_fk" FOREIGN KEY ("model_provider_id") REFERENCES "public"."model_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_knowledge_collections" ADD CONSTRAINT "agent_knowledge_collections_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_knowledge_collections" ADD CONSTRAINT "agent_knowledge_collections_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mcp_servers" ADD CONSTRAINT "agent_mcp_servers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mcp_servers" ADD CONSTRAINT "agent_mcp_servers_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_knowledge_document_id_knowledge_documents_id_fk" FOREIGN KEY ("knowledge_document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_knowledge_collection_id_knowledge_collections_id_fk" FOREIGN KEY ("knowledge_collection_id") REFERENCES "public"."knowledge_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_collections" ADD CONSTRAINT "knowledge_collections_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_collections" ADD CONSTRAINT "knowledge_collections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledge_collection_id_knowledge_collections_id_fk" FOREIGN KEY ("knowledge_collection_id") REFERENCES "public"."knowledge_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_versions" ADD CONSTRAINT "tool_versions_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_versions" ADD CONSTRAINT "tool_versions_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_registered_by_id_users_id_fk" FOREIGN KEY ("registered_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_whitelist" ADD CONSTRAINT "mcp_server_whitelist_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_whitelist" ADD CONSTRAINT "mcp_server_whitelist_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_registered_by_id_users_id_fk" FOREIGN KEY ("registered_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tools" ADD CONSTRAINT "mcp_tools_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tools" ADD CONSTRAINT "mcp_tools_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_template_versions" ADD CONSTRAINT "prompt_template_versions_prompt_template_id_prompt_templates_id_fk" FOREIGN KEY ("prompt_template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_template_versions" ADD CONSTRAINT "prompt_template_versions_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_stats" ADD CONSTRAINT "usage_stats_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_stats" ADD CONSTRAINT "usage_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_stats" ADD CONSTRAINT "usage_stats_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonator_id_users_id_fk" FOREIGN KEY ("impersonator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_initiated_by_id_users_id_fk" FOREIGN KEY ("initiated_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_providers" ADD CONSTRAINT "sso_providers_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_sso_provider_id_sso_providers_id_fk" FOREIGN KEY ("sso_provider_id") REFERENCES "public"."sso_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_executions" ADD CONSTRAINT "sandbox_executions_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_executions" ADD CONSTRAINT "sandbox_executions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_filters" ADD CONSTRAINT "content_filters_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_jobs" ADD CONSTRAINT "data_jobs_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_jobs" ADD CONSTRAINT "data_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_jobs" ADD CONSTRAINT "data_jobs_source_file_id_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_jobs" ADD CONSTRAINT "data_jobs_result_file_id_files_id_fk" FOREIGN KEY ("result_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dlp_rules" ADD CONSTRAINT "dlp_rules_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_rules" ADD CONSTRAINT "domain_rules_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_rules" ADD CONSTRAINT "domain_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_configured_by_id_users_id_fk" FOREIGN KEY ("configured_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ADD CONSTRAINT "rate_limit_rules_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_health_checks" ADD CONSTRAINT "system_health_checks_checked_by_id_users_id_fk" FOREIGN KEY ("checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_keyboard_shortcuts" ADD CONSTRAINT "user_keyboard_shortcuts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_keyboard_shortcuts" ADD CONSTRAINT "user_keyboard_shortcuts_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_settings_org_key" ON "org_settings" USING btree ("org_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_organisations_slug" ON "organisations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_organisations_domain" ON "organisations" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_organisations_active" ON "organisations" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_magic_link_tokens_hash" ON "magic_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_magic_link_tokens_user_id" ON "magic_link_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mfa_credentials_user_id" ON "mfa_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_token_hash" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_profiles_user_org" ON "user_profiles" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_org_id" ON "user_profiles" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_external_id" ON "users" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_users_active" ON "users" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_group_memberships_group_user" ON "group_memberships" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_group_memberships_org_id" ON "group_memberships" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_group_memberships_user_id" ON "group_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_groups_org_id" ON "groups" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_groups_org_name" ON "groups" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "idx_workspace_memberships_org_id" ON "workspace_memberships" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_workspaces_org_id" ON "workspaces" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_workspaces_owner_id" ON "workspaces" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_folders_org_user" ON "conversation_folders" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conversation_participants_conv_user" ON "conversation_participants" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_participants_org_id" ON "conversation_participants" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_tag_assignments_conv" ON "conversation_tag_assignments" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_tag_assignments_org" ON "conversation_tag_assignments" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conversation_tags_org_user_name" ON "conversation_tags" USING btree ("org_id","user_id","name");--> statement-breakpoint
CREATE INDEX "idx_conversations_org_owner" ON "conversations" USING btree ("org_id","owner_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_workspace" ON "conversations" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conversations_share_token" ON "conversations" USING btree ("public_share_token");--> statement-breakpoint
CREATE INDEX "idx_conversations_org_active" ON "conversations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_message_attachments_message_id" ON "message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_message_attachments_org_id" ON "message_attachments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_message_notes_message_user" ON "message_notes" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_message_notes_org_id" ON "message_notes" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_message_ratings_message_user" ON "message_ratings" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_message_ratings_org_id" ON "message_ratings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_created" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_org_id" ON "messages" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_messages_parent" ON "messages" USING btree ("parent_message_id");--> statement-breakpoint
CREATE INDEX "idx_messages_active" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_file_chunks_file_index" ON "file_chunks" USING btree ("file_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_file_chunks_org_id" ON "file_chunks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_files_org_user" ON "files" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_files_workspace" ON "files" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_files_org_active" ON "files" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_model_providers_org_id" ON "model_providers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_models_org_id" ON "models" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_models_provider" ON "models" USING btree ("model_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_models_org_external_id" ON "models" USING btree ("org_id","model_id_external");--> statement-breakpoint
CREATE INDEX "idx_agent_knowledge_collections_org_id" ON "agent_knowledge_collections" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_mcp_servers_agent_mcp" ON "agent_mcp_servers" USING btree ("agent_id","mcp_server_id");--> statement-breakpoint
CREATE INDEX "idx_agent_mcp_servers_org_id" ON "agent_mcp_servers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_agent_scope" ON "agent_memory_entries" USING btree ("agent_id","scope");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_org_id" ON "agent_memory_entries" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_skills_agent_skill" ON "agent_skills" USING btree ("agent_id","skill_name");--> statement-breakpoint
CREATE INDEX "idx_agent_skills_org_id" ON "agent_skills" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_tools_agent_tool" ON "agent_tools" USING btree ("agent_id","tool_id");--> statement-breakpoint
CREATE INDEX "idx_agent_tools_org_id" ON "agent_tools" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_versions_agent_version" ON "agent_versions" USING btree ("agent_id","version");--> statement-breakpoint
CREATE INDEX "idx_agent_versions_org_id" ON "agent_versions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_agents_org_id" ON "agents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_agents_owner_id" ON "agents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_agents_org_active" ON "agents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_document_index" ON "knowledge_chunks" USING btree ("knowledge_document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_collection" ON "knowledge_chunks" USING btree ("knowledge_collection_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_org_id" ON "knowledge_chunks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_collections_org_owner" ON "knowledge_collections" USING btree ("org_id","owner_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_collections_org_active" ON "knowledge_collections" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_documents_collection" ON "knowledge_documents" USING btree ("knowledge_collection_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_documents_org_id" ON "knowledge_documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_tool_calls_message_id" ON "tool_calls" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_tool_calls_conversation_id" ON "tool_calls" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_tool_calls_org_id" ON "tool_calls" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tool_versions_tool_version" ON "tool_versions" USING btree ("tool_id","version");--> statement-breakpoint
CREATE INDEX "idx_tool_versions_org_id" ON "tool_versions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_tools_org_id" ON "tools" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tools_org_name" ON "tools" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "idx_mcp_server_whitelist_org_id" ON "mcp_server_whitelist" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mcp_server_whitelist_org_pattern" ON "mcp_server_whitelist" USING btree ("org_id","url_pattern");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_org_id" ON "mcp_servers" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mcp_servers_org_url" ON "mcp_servers" USING btree ("org_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mcp_tools_server_name" ON "mcp_tools" USING btree ("mcp_server_id","name");--> statement-breakpoint
CREATE INDEX "idx_mcp_tools_org_id" ON "mcp_tools" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_prefs_unique" ON "notification_preferences" USING btree ("user_id","org_id","notification_type","channel");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_unread" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_org_id" ON "notifications" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_prompt_template_versions_org_id" ON "prompt_template_versions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_prompt_templates_org_id" ON "prompt_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_prompt_templates_owner_id" ON "prompt_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_usage_stats_org_period" ON "usage_stats" USING btree ("org_id","period","period_start");--> statement-breakpoint
CREATE INDEX "idx_usage_stats_user_period" ON "usage_stats" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org_created" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor_id" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_api_keys_key_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_org_user" ON "api_keys" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_org_id" ON "workflows" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_temporal_wf_id" ON "workflows" USING btree ("temporal_workflow_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_org_status" ON "workflows" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "idx_sso_providers_org_id" ON "sso_providers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_sso_sessions_session_id" ON "sso_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_sso_sessions_provider_external" ON "sso_sessions" USING btree ("sso_provider_id","external_user_id");--> statement-breakpoint
CREATE INDEX "idx_sandbox_executions_org_id" ON "sandbox_executions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_artifacts_message_id" ON "artifacts" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_artifacts_conversation_id" ON "artifacts" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_artifacts_org_id" ON "artifacts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_org_id" ON "invitations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_token_hash" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_invitations_email" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_content_filters_org_id" ON "content_filters" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_data_jobs_org_user" ON "data_jobs" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_dlp_rules_org_id" ON "dlp_rules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_domain_rules_org_id" ON "domain_rules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_domain_rules_org_domain" ON "domain_rules" USING btree ("org_id","domain");--> statement-breakpoint
CREATE INDEX "idx_integrations_org_id" ON "integrations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_rate_limit_rules_org_scope" ON "rate_limit_rules" USING btree ("org_id","scope");--> statement-breakpoint
CREATE INDEX "idx_research_reports_org_id" ON "research_reports" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_system_health_checks_service_created" ON "system_health_checks" USING btree ("service");