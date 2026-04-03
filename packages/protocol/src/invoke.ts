import { z } from "zod";

// ---------------------------------------------------------------------------
// Effort Configuration
// ---------------------------------------------------------------------------

export const effortLevelSchema = z.enum(["low", "medium", "high"]);
export type EffortLevel = z.infer<typeof effortLevelSchema>;

export const effortConfigSchema = z.object({
  level: effortLevelSchema,
  thinkingBudgetTokens: z.number().optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
});
export type EffortConfig = z.infer<typeof effortConfigSchema>;

// ---------------------------------------------------------------------------
// Tool Call Record
// ---------------------------------------------------------------------------

export const toolCallRecordSchema = z.object({
  toolName: z.string(),
  input: z.record(z.string(), z.unknown()),
  output: z.unknown(),
  error: z.string().optional(),
  durationMs: z.number(),
});
export type ToolCallRecord = z.infer<typeof toolCallRecordSchema>;

// ---------------------------------------------------------------------------
// User Interaction Protocol
// ---------------------------------------------------------------------------

export const interactionTypeSchema = z.enum([
  "option_selection",
  "feedback_prompt",
  "approval_gate",
  "text_input",
]);
export type InteractionType = z.infer<typeof interactionTypeSchema>;

export const interactionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});
export type InteractionOption = z.infer<typeof interactionOptionSchema>;

export const userInteractionRequestSchema = z.object({
  id: z.string(),
  type: interactionTypeSchema,
  prompt: z.string(),
  options: z.array(interactionOptionSchema).optional(),
  nodeId: z.string().optional(),
  timeoutMs: z.number(),
});
export type UserInteractionRequest = z.infer<typeof userInteractionRequestSchema>;

export const userInteractionResponseSchema = z.object({
  requestId: z.string(),
  type: interactionTypeSchema,
  selectedOptionId: z.string().optional(),
  textInput: z.string().optional(),
  approved: z.boolean().optional(),
});
export type UserInteractionResponse = z.infer<typeof userInteractionResponseSchema>;

// ---------------------------------------------------------------------------
// Research Config
// ---------------------------------------------------------------------------

export const researchConfigSchema = z.object({
  reportId: z.string(),
  query: z.string(),
  maxSources: z.number(),
  sources: z.object({
    webSearch: z.boolean(),
    knowledgeCollectionIds: z.array(z.string()),
    fileIds: z.array(z.string()),
  }),
  refinement: z.object({
    previousContent: z.string(),
    previousSources: z.array(z.unknown()),
    prompt: z.string(),
    versionId: z.string(),
  }).optional(),
});
export type ResearchConfig = z.infer<typeof researchConfigSchema>;

// ---------------------------------------------------------------------------
// Invoke Request (POST /invoke body)
// ---------------------------------------------------------------------------

export const invokeRequestSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  conversationId: z.string().uuid(),
  streamChannelId: z.string().optional(),
  agentId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
  userMessage: z.string().optional(),
  messageHistory: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).optional(),
  pendingToolCalls: z.array(z.object({
    id: z.string(),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
  model: z.string(),
  modelParams: z.object({
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
  }).optional(),
  effort: effortConfigSchema.optional(),
  tools: z.array(z.unknown()).optional(),
  maxSteps: z.number().optional(),
  timeoutSeconds: z.number().optional(),
  preAssessedTier: z.enum(["direct", "sequential", "orchestrated"]).optional(),
  researchConfig: researchConfigSchema.optional(),
});
export type InvokeRequest = z.infer<typeof invokeRequestSchema>;

// ---------------------------------------------------------------------------
// Invoke Result (returned in "done" SSE event)
// ---------------------------------------------------------------------------

export const executionTierSchema = z.enum(["direct", "sequential", "orchestrated"]);
export type ExecutionTier = z.infer<typeof executionTierSchema>;

export const invokeResultSchema = z.object({
  conversationId: z.string(),
  content: z.string(),
  messageIds: z.array(z.string()),
  totalTokens: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  steps: z.number(),
  status: z.enum([
    "completed",
    "cancelled",
    "timeout",
    "max_steps",
    "awaiting_input",
    "awaiting_approval",
  ]),
  toolCallRecords: z.array(toolCallRecordSchema),
  tier: executionTierSchema,
});
export type InvokeResult = z.infer<typeof invokeResultSchema>;
