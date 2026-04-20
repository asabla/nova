export const CONVERSATION_VISIBILITY = ["private", "team", "public"] as const;
export type ConversationVisibility = (typeof CONVERSATION_VISIBILITY)[number];

export const MESSAGE_ROLE = ["user", "assistant", "system", "tool"] as const;
export type MessageRole = (typeof MESSAGE_ROLE)[number];

export const AGENT_STATUS = ["draft", "published", "archived"] as const;
export type AgentStatus = (typeof AGENT_STATUS)[number];

export const TOOL_APPROVAL_MODE = ["auto", "always-ask", "never"] as const;
export type ToolApprovalMode = (typeof TOOL_APPROVAL_MODE)[number];

export const WORKFLOW_STATUS = [
  "queued",
  "running",
  "waiting_approval",
  "waiting_input",
  "completed",
  "stopped",
  "error",
  "timeout",
  "cancelled",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUS)[number];

export const MESSAGE_STATUS = ["streaming", "completed", "failed", "cancelled"] as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[number];

export const RESEARCH_STATUS = [
  "pending",
  "queued",
  "searching",
  "analyzing",
  "generating",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ResearchStatus = (typeof RESEARCH_STATUS)[number];

export const RESEARCH_PROGRESS_TYPE = [
  "query",
  "source",
  "analysis",
  "synthesis",
  "info",
  "error",
] as const;
export type ResearchProgressType = (typeof RESEARCH_PROGRESS_TYPE)[number];

export const TOOL_CALL_STATUS = [
  "pending",
  "running",
  "completed",
  "failed",
  "approval_required",
  "timeout",
] as const;
export type ToolCallStatus = (typeof TOOL_CALL_STATUS)[number];

export const FILE_STATUS = ["uploading", "processing", "ready", "infected", "error"] as const;
export type FileStatus = (typeof FILE_STATUS)[number];

export const COLLECTION_STATUS = ["empty", "indexing", "ready", "error"] as const;
export type CollectionStatus = (typeof COLLECTION_STATUS)[number];

export const NOTIFICATION_TYPE = [
  "share",
  "mention",
  "agent_complete",
  "export_ready",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[number];

export const MEMORY_SCOPE = ["per-user", "per-conversation", "global"] as const;
export type MemoryScope = (typeof MEMORY_SCOPE)[number];

export const BILLING_PLAN = ["free", "pro", "enterprise"] as const;
export type BillingPlan = (typeof BILLING_PLAN)[number];

export const THEME = ["light", "dark", "system"] as const;
export type Theme = (typeof THEME)[number];

export const FONT_SIZE = ["small", "medium", "large"] as const;
export type FontSize = (typeof FONT_SIZE)[number];

// Re-export agent flow constants (canonical definitions live in types/agent-flow.ts)
export {
  EXECUTION_TIERS,
  type ExecutionTier,
  EFFORT_LEVELS,
  type EffortLevel,
  PLAN_NODE_STATUSES,
  type PlanNodeStatus,
  INTERACTION_TYPES,
  type InteractionType,
} from "../types/agent-flow.js";
