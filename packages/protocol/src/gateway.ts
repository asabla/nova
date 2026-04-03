import { z } from "zod";

// ---------------------------------------------------------------------------
// Gateway API Contracts
// ---------------------------------------------------------------------------
// These define the request/response shapes for the Nova Gateway HTTP API.
// Workers call the gateway for all infrastructure access.
// ---------------------------------------------------------------------------

// --- Stream ---

export const streamTokenRequestSchema = z.object({
  channelId: z.string(),
  token: z.string(),
});

export const streamToolStatusRequestSchema = z.object({
  channelId: z.string(),
  tool: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "approval_required", "timeout"]),
  args: z.record(z.string(), z.unknown()).optional(),
  resultSummary: z.string().optional(),
});

export const streamEventRequestSchema = z.object({
  channelId: z.string(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export const streamDoneRequestSchema = z.object({
  channelId: z.string(),
  content: z.string(),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
  }),
});

export const streamErrorRequestSchema = z.object({
  channelId: z.string(),
  message: z.string(),
});

// --- Database ---

export const dbQueryMessagesRequestSchema = z.object({
  conversationId: z.string().uuid(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export const dbCreateMessageRequestSchema = z.object({
  conversationId: z.string().uuid(),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const dbUpdateMessageRequestSchema = z.object({
  content: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const dbUpdateWorkflowRequestSchema = z.object({
  status: z.string(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
});

// --- LLM ---

export const llmChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.union([z.string(), z.array(z.unknown())]),
  })),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  tools: z.array(z.unknown()).optional(),
  stream: z.boolean().optional(),
});

export const llmEmbeddingRequestSchema = z.object({
  model: z.string().optional(),
  input: z.union([z.string(), z.array(z.string())]),
});

// --- Vectors ---

export const vectorSearchRequestSchema = z.object({
  collection: z.string(),
  query: z.array(z.number()),
  filter: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().optional(),
});

export const vectorUpsertRequestSchema = z.object({
  collection: z.string(),
  points: z.array(z.object({
    id: z.string(),
    vector: z.array(z.number()),
    payload: z.record(z.string(), z.unknown()).optional(),
  })),
});

export const vectorDeleteRequestSchema = z.object({
  collection: z.string(),
  filter: z.record(z.string(), z.unknown()),
});

// --- Storage ---

export const storagePutRequestSchema = z.object({
  key: z.string(),
  contentType: z.string().optional(),
});

// --- Health ---

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  services: z.object({
    db: z.boolean(),
    redis: z.boolean(),
    qdrant: z.boolean(),
    s3: z.boolean(),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
