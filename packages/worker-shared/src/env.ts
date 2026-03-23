import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
  TEMPORAL_NAMESPACE: z.string().default("default"),

  WORKER_MAX_ACTIVITIES: z.coerce.number().int().positive().default(10),
  WORKER_MAX_WORKFLOWS: z.coerce.number().int().positive().default(40),

  WORKER_BUILD_ID: z.string().default("dev"),

  LITELLM_URL: z.string().url().optional(),
  LITELLM_API_KEY: z.string().optional(),
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

  MINIO_ENDPOINT: z.string().default("http://minio:9000"),
  MINIO_ROOT_USER: z.string().default("minioadmin"),
  MINIO_ROOT_PASSWORD: z.string().default("minioadmin"),
  MINIO_BUCKET: z.string().default("nova-files"),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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
