ALTER TABLE "model_providers" ADD COLUMN "provider_params" jsonb;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "model_params" jsonb;