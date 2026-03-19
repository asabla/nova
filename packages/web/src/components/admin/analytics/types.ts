export interface Summary {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostCents: number;
  totalRequests: number;
  avgLatencyMs: number;
  activeUsers: number;
  totalUsers: number;
  totalErrors: number;
  errorRate: number;
}

export interface DailyRow {
  date: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
}

export interface ModelRow {
  modelId: string;
  modelName: string;
  modelExternalId: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
}

export interface UserRow {
  userId: string;
  displayName: string;
  email: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  requestCount: number;
  errorCount: number;
}

export interface GroupRow {
  groupId: string;
  groupName: string;
  totalTokens: number;
  costCents: number;
  requestCount: number;
  errorCount: number;
  memberCount: number;
}

export interface TrendPeriod {
  totalTokens: number;
  costCents: number;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
}

export interface Trends {
  weekly: {
    current: TrendPeriod;
    previous: TrendPeriod;
    tokenChange: number;
    costChange: number;
    requestChange: number;
  };
  monthly: {
    current: TrendPeriod;
    previous: TrendPeriod;
    tokenChange: number;
    costChange: number;
    requestChange: number;
  };
}

export interface CostData {
  totalCostCents: number;
  totalRequests: number;
  totalTokens: number;
  currentMonthCostCents: number;
  currentMonthRequests: number;
  currentMonthTokens: number;
  projectedMonthlyCostCents: number;
  dailyCosts: { date: string; costCents: number }[];
}

export interface BudgetAlert {
  id: string;
  name: string;
  scope: "org" | "group" | "user";
  scopeId?: string;
  thresholdType: "cost_cents" | "tokens";
  thresholdValue: number;
  period: "daily" | "weekly" | "monthly";
  notifyEmail: boolean;
  notifyWebhook: boolean;
  webhookUrl?: string;
  isEnabled: boolean;
  createdAt: string;
}

export interface BudgetStatus {
  alertId: string;
  name: string;
  scope: string;
  period: string;
  thresholdType: string;
  thresholdValue: number;
  currentValue: number;
  percentage: number;
  isExceeded: boolean;
  isWarning: boolean;
}

export interface AgentRun {
  id: string;
  agentName: string;
  conversationId: string;
  userId: string;
  userName: string;
  modelName: string;
  status: "success" | "error" | "timeout" | "running";
  startedAt: string;
  durationMs: number;
  totalTokens: number;
  costCents: number;
  toolCalls: ToolCall[];
  errorMessage?: string;
}

export interface ToolCall {
  name: string;
  durationMs: number;
  status: "success" | "error";
  input?: string;
  output?: string;
}

export type CostBreakdownTab = "model" | "user" | "group";
export type MainTab = "overview" | "performance" | "budgets" | "traces" | "integrations";
export type DatePreset = "today" | "7d" | "30d" | "90d" | "custom";

// ── Helpers ──────────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getDateRange(preset: DatePreset, custom: { from: string; to: string }) {
  const to = new Date();
  const from = new Date();

  switch (preset) {
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from.setDate(from.getDate() - 90);
      break;
    case "custom":
      return custom;
  }

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
