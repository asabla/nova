import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
  TEMPORAL_NAMESPACE: z.string().default("default"),

  WORKER_MAX_ACTIVITIES: z.coerce.number().int().positive().default(10),
  WORKER_MAX_WORKFLOWS: z.coerce.number().int().positive().default(40),

  WORKER_BUILD_ID: z.string().default("dev"),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  RESEARCH_MODEL: z.string().optional(),
  VISION_MODEL: z.string().optional(),

  SEARXNG_URL: z.string().optional(),

  QDRANT_URL: z.string().default("http://localhost:6333"),
  QDRANT_API_KEY: z.string().optional(),

  SANDBOX_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  SANDBOX_DOCKER_HOST: z.string().optional(),

  VISION_VERIFY_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("true")
    .transform((v) => v === "true" || v === "1"),

  IMAGE_GENERATION_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  IMAGE_GENERATION_MODEL: z.string().default("gpt-image-1"),

  S3_ENDPOINT: z.string().default("http://rustfs:9000"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  S3_BUCKET: z.string().default("nova-files"),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // OpenTelemetry
  OTEL_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().optional(),
});

export type WorkerEnv = z.infer<typeof envSchema>;

function loadEnv(): WorkerEnv {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
