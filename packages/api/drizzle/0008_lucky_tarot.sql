ALTER TABLE "agents" ADD COLUMN "builtin_tools" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_model_providers_org_name" ON "model_providers" USING btree ("org_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agents_org_name" ON "agents" USING btree ("org_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_prompt_templates_org_name" ON "prompt_templates" USING btree ("org_id","name");--> statement-breakpoint
ALTER TABLE "usage_stats" ADD CONSTRAINT "uq_usage_stats_daily" UNIQUE NULLS NOT DISTINCT("org_id","user_id","group_id","model_id","period","period_start");