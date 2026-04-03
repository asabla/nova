import { z } from "zod";
import { toolCallRecordSchema, userInteractionRequestSchema, userInteractionResponseSchema } from "./invoke";

// ---------------------------------------------------------------------------
// SSE Event Types for Worker Protocol
// ---------------------------------------------------------------------------
// Workers return these as Server-Sent Events from POST /invoke.
// The proxy activity reads them and republishes to Redis.
// ---------------------------------------------------------------------------

/** Token streaming event — emitted for each generated token/chunk. */
export const tokenEventSchema = z.object({
  type: z.literal("token"),
  content: z.string(),
});

/** Tool status event — emitted when a tool call starts, completes, or fails. */
export const toolStatusEventSchema = z.object({
  type: z.literal("tool_status"),
  tool: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "approval_required", "timeout"]),
  args: z.record(z.string(), z.unknown()).optional(),
  resultSummary: z.string().optional(),
});

/** Content clear event — signals the client to clear accumulated content. */
export const contentClearEventSchema = z.object({
  type: z.literal("content_clear"),
  reason: z.string().optional(),
});

/** Done event — signals successful completion. Payload maps to InvokeResult. */
export const doneEventSchema = z.object({
  type: z.literal("done"),
  content: z.string(),
  messageIds: z.array(z.string()).optional(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
  }),
  toolCallRecords: z.array(toolCallRecordSchema).optional(),
  steps: z.number().optional(),
});

/** Error event — signals a failure. */
export const errorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  retryable: z.boolean().optional(),
});

/** Tier assessed event — emitted when the execution tier is determined. */
export const tierAssessedEventSchema = z.object({
  type: z.literal("tier.assessed"),
  tier: z.enum(["direct", "sequential", "orchestrated"]),
  reasoning: z.string(),
});

/** Plan generated event — emitted when a DAG plan is created. */
export const planGeneratedEventSchema = z.object({
  type: z.literal("plan.generated"),
  plan: z.object({
    id: z.string(),
    tier: z.enum(["direct", "sequential", "orchestrated"]),
    reasoning: z.string(),
    nodes: z.array(z.object({
      id: z.string(),
      description: z.string(),
      dependencies: z.array(z.string()),
      status: z.enum(["pending", "ready", "running", "completed", "failed", "skipped"]),
    })),
    approvalRequired: z.boolean(),
  }),
});

/** Plan node status event — emitted when a plan node changes state. */
export const planNodeStatusEventSchema = z.object({
  type: z.literal("plan.node.status"),
  nodeId: z.string(),
  status: z.enum(["pending", "ready", "running", "completed", "failed", "skipped"]),
  detail: z.string().optional(),
});

/** Interaction request event — worker asks the user for input. */
export const interactionRequestEventSchema = z.object({
  type: z.literal("interaction.request"),
  request: userInteractionRequestSchema,
});

/** Interaction response event — user responds to interaction request. */
export const interactionResponseEventSchema = z.object({
  type: z.literal("interaction.response"),
  response: userInteractionResponseSchema,
});

/** Research status event. */
export const researchStatusEventSchema = z.object({
  type: z.literal("research.status"),
  status: z.enum(["pending", "queued", "searching", "analyzing", "generating", "completed", "failed", "cancelled"]),
  phase: z.string().optional(),
});

/** Research source event. */
export const researchSourceEventSchema = z.object({
  type: z.literal("research.source"),
  title: z.string(),
  url: z.string(),
  relevance: z.number().optional(),
});

/** Research progress event. */
export const researchProgressEventSchema = z.object({
  type: z.literal("research.progress"),
  progressType: z.enum(["query", "source", "analysis", "synthesis", "info", "error"]),
  message: z.string(),
  sourceUrl: z.string().optional(),
});

/** Research done event. */
export const researchDoneEventSchema = z.object({
  type: z.literal("research.done"),
  reportId: z.string(),
  sourcesCount: z.number(),
});

/** Research error event. */
export const researchErrorEventSchema = z.object({
  type: z.literal("research.error"),
  message: z.string(),
});

/** Retry event — worker is retrying after a transient failure. */
export const retryEventSchema = z.object({
  type: z.literal("retry"),
  attempt: z.number(),
  maxAttempts: z.number(),
  error: z.string(),
});

// ---------------------------------------------------------------------------
// Discriminated union of all SSE event types
// ---------------------------------------------------------------------------

export const workerSSEEventSchema = z.discriminatedUnion("type", [
  tokenEventSchema,
  toolStatusEventSchema,
  contentClearEventSchema,
  doneEventSchema,
  errorEventSchema,
  tierAssessedEventSchema,
  planGeneratedEventSchema,
  planNodeStatusEventSchema,
  interactionRequestEventSchema,
  interactionResponseEventSchema,
  researchStatusEventSchema,
  researchSourceEventSchema,
  researchProgressEventSchema,
  researchDoneEventSchema,
  researchErrorEventSchema,
  retryEventSchema,
]);

export type WorkerSSEEvent = z.infer<typeof workerSSEEventSchema>;
export type TokenEvent = z.infer<typeof tokenEventSchema>;
export type DoneEvent = z.infer<typeof doneEventSchema>;
export type ErrorEvent = z.infer<typeof errorEventSchema>;
export type ToolStatusEvent = z.infer<typeof toolStatusEventSchema>;
