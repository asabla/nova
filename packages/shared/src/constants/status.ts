export const CONVERSATION_VISIBILITY = ["private", "team", "public"] as const;
export type ConversationVisibility = (typeof CONVERSATION_VISIBILITY)[number];

export const MESSAGE_ROLE = ["user", "assistant", "system", "tool"] as const;
export type MessageRole = (typeof MESSAGE_ROLE)[number];

export const AGENT_STATUS = ["draft", "published", "archived"] as const;
export type AgentStatus = (typeof AGENT_STATUS)[number];

export const TOOL_APPROVAL_MODE = ["auto", "always-ask", "never"] as const;
export type ToolApprovalMode = (typeof TOOL_APPROVAL_MODE)[number];

export const WORKFLOW_STATUS = [
  "running",
  "waiting_approval",
  "waiting_input",
  "completed",
  "stopped",
  "error",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUS)[number];

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
