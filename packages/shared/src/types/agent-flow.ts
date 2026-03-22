// ---------------------------------------------------------------------------
// Execution Tiers
// ---------------------------------------------------------------------------

/** How much orchestration overhead to apply to a task. */
export const EXECUTION_TIERS = ["direct", "sequential", "orchestrated"] as const;
export type ExecutionTier = (typeof EXECUTION_TIERS)[number];

/** Result of the tier-assessment LLM call. */
export interface TierAssessment {
  tier: ExecutionTier;
  confidence: number; // 0–1
  reasoning: string;
  suggestedEffort: EffortLevel;
}

// ---------------------------------------------------------------------------
// Effort Levels
// ---------------------------------------------------------------------------

export const EFFORT_LEVELS = ["low", "medium", "high"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

/** Model-agnostic effort configuration. Activities map these to provider params. */
export interface EffortConfig {
  level: EffortLevel;
  /** Claude: `thinking.budget_tokens` */
  thinkingBudgetTokens?: number;
  /** OpenAI: `reasoning_effort` */
  reasoningEffort?: "low" | "medium" | "high";
}

// ---------------------------------------------------------------------------
// DAG-based Plan
// ---------------------------------------------------------------------------

export const PLAN_NODE_STATUSES = [
  "pending",
  "ready",
  "running",
  "completed",
  "failed",
  "skipped",
] as const;
export type PlanNodeStatus = (typeof PLAN_NODE_STATUSES)[number];

export interface PlanNodeResult {
  content: string;
  toolCallRecords: ToolCallRecord[];
  tokensUsed: number;
  durationMs: number;
}

export interface PlanNode {
  id: string;
  description: string;
  tools?: string[];
  /** IDs of nodes that must complete before this one can start. */
  dependencies: string[];
  /** Use a cheaper/faster model for simple leaf steps. */
  assignedModel?: string;
  effort?: EffortLevel;
  /** Nested plan executed by a sub-agent. */
  subPlan?: Plan;
  status: PlanNodeStatus;
  result?: PlanNodeResult;
}

export interface Plan {
  id: string;
  tier: ExecutionTier;
  reasoning: string;
  nodes: PlanNode[];
  /** If true, the workflow pauses for user approval before executing. */
  approvalRequired: boolean;
  approved?: boolean;
}

// ---------------------------------------------------------------------------
// Tool Call Record  (shared across workflows)
// ---------------------------------------------------------------------------

export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// User Interaction Protocol
// ---------------------------------------------------------------------------

export const INTERACTION_TYPES = [
  "option_selection",
  "feedback_prompt",
  "approval_gate",
  "text_input",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export interface InteractionOption {
  id: string;
  label: string;
  description?: string;
}

export interface UserInteractionRequest {
  id: string;
  type: InteractionType;
  prompt: string;
  options?: InteractionOption[];
  /** Which plan node triggered this (if any). */
  nodeId?: string;
  timeoutMs: number;
}

export interface UserInteractionResponse {
  requestId: string;
  type: InteractionType;
  selectedOptionId?: string;
  textInput?: string;
  approved?: boolean;
}

// ---------------------------------------------------------------------------
// Research Report Versioning
// ---------------------------------------------------------------------------

export interface ResearchReportVersion {
  id: string;
  reportId: string;
  version: number;
  /** The user's refinement request (null for the initial version). */
  refinementPrompt?: string;
  parentVersionId?: string;
  reportContent: string;
  sources: unknown[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// SSE Events (agent flow)
// ---------------------------------------------------------------------------

export type AgentFlowSSEEvent =
  | { event: "tier.assessed"; data: { tier: ExecutionTier; reasoning: string } }
  | { event: "plan.generated"; data: { plan: Plan } }
  | { event: "plan.approved"; data: { planId: string } }
  | {
      event: "plan.node.status";
      data: { nodeId: string; status: PlanNodeStatus; detail?: string };
    }
  | { event: "interaction.request"; data: UserInteractionRequest }
  | { event: "interaction.response"; data: UserInteractionResponse }
  | {
      event: "research.version.created";
      data: { versionId: string; version: number };
    };

// ---------------------------------------------------------------------------
// Workflow Input / State (shared between API & worker)
// ---------------------------------------------------------------------------

export interface AgentWorkflowInput {
  orgId: string;
  userId: string;
  conversationId: string;
  streamChannelId?: string;
  agentId?: string;
  workflowId?: string;
  userMessage?: string;
  messageHistory?: { role: string; content: string }[];
  pendingToolCalls?: {
    id: string;
    function: { name: string; arguments: string };
  }[];
  model: string;
  modelParams?: { temperature?: number; maxTokens?: number };
  effort?: EffortConfig;
  tools?: unknown[];
  maxSteps?: number;
  timeoutSeconds?: number;
  /** Set to true when Temporal custom search attributes are registered */
  enableSearchAttributes?: boolean;
}

export interface AgentWorkflowResult {
  conversationId: string;
  content: string;
  messageIds: string[];
  totalTokens: number;
  steps: number;
  status:
    | "completed"
    | "cancelled"
    | "timeout"
    | "max_steps"
    | "awaiting_input"
    | "awaiting_approval";
  toolCallRecords: ToolCallRecord[];
  tier: ExecutionTier;
  plan?: Plan;
}

export interface AgentWorkflowState {
  tier: ExecutionTier;
  plan?: Plan;
  currentNodeId?: string;
  pendingInteraction?: UserInteractionRequest;
  pendingToolApprovals: string[];
  status: string;
  step: number;
  totalTokens: number;
}
