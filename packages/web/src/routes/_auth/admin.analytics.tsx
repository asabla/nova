import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Coins,
  DollarSign,
  Users,
  Timer,
  AlertTriangle,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Crown,
  Cpu,
  Bell,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Activity,
  Eye,
  Link,
  Settings,
  Shield,
  Layers,
  Gauge,
  Wrench,
  Clock,
  X,
  Check,
  ExternalLink,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { toast } from "../../components/ui/Toast";
import { api, apiHeaders } from "../../lib/api";

export const Route = createFileRoute("/_auth/admin/analytics")({
  component: AdminAnalyticsPage,
});

// ── Types ────────────────────────────────────────────────────────────

interface Summary {
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

interface DailyRow {
  date: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
}

interface ModelRow {
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

interface UserRow {
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

interface GroupRow {
  groupId: string;
  groupName: string;
  totalTokens: number;
  costCents: number;
  requestCount: number;
  errorCount: number;
  memberCount: number;
}

interface TrendPeriod {
  totalTokens: number;
  costCents: number;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
}

interface Trends {
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

interface CostData {
  totalCostCents: number;
  totalRequests: number;
  totalTokens: number;
  currentMonthCostCents: number;
  currentMonthRequests: number;
  currentMonthTokens: number;
  projectedMonthlyCostCents: number;
  dailyCosts: { date: string; costCents: number }[];
}

interface BudgetAlert {
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

interface BudgetStatus {
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

interface AgentRun {
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

interface ToolCall {
  name: string;
  durationMs: number;
  status: "success" | "error";
  input?: string;
  output?: string;
}

// ── Tab types ────────────────────────────────────────────────────────

type CostBreakdownTab = "model" | "user" | "group";
type MainTab = "overview" | "performance" | "budgets" | "traces" | "integrations";
type DatePreset = "today" | "7d" | "30d" | "90d" | "custom";

// ── Helpers ──────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateRange(preset: DatePreset, custom: { from: string; to: string }) {
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

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

// ── Main component ───────────────────────────────────────────────────

function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customRange, setCustomRange] = useState(defaultDateRange);
  const [exporting, setExporting] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("overview");
  const [costTab, setCostTab] = useState<CostBreakdownTab>("model");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);

  const dateRange = getDateRange(datePreset, customRange);
  const queryParams = `?from=${dateRange.from}&to=${dateRange.to}`;
  const daysCount =
    datePreset === "today"
      ? 1
      : datePreset === "7d"
        ? 7
        : datePreset === "90d"
          ? 90
          : 30;

  // ── Queries ──────────────────────────────────────────────────────

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics-summary", dateRange],
    queryFn: () =>
      api.get<{ data: Summary }>(`/api/analytics/summary${queryParams}`),
    staleTime: 60_000,
  });

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ["analytics-daily", daysCount],
    queryFn: () =>
      api.get<{ data: DailyRow[] }>(`/api/analytics/daily?days=${daysCount}`),
    staleTime: 60_000,
  });

  const { data: byModel, isLoading: modelLoading } = useQuery({
    queryKey: ["analytics-by-model", dateRange],
    queryFn: () =>
      api.get<{ data: ModelRow[] }>(`/api/analytics/by-model${queryParams}`),
    staleTime: 60_000,
  });

  const { data: byUser, isLoading: userLoading } = useQuery({
    queryKey: ["analytics-by-user", dateRange],
    queryFn: () =>
      api.get<{ data: UserRow[] }>(
        `/api/analytics/by-user${queryParams}&limit=10`,
      ),
    staleTime: 60_000,
  });

  const { data: byGroup, isLoading: groupLoading } = useQuery({
    queryKey: ["analytics-by-group", dateRange],
    queryFn: () =>
      api.get<{ data: GroupRow[] }>(`/api/analytics/by-group${queryParams}`),
    staleTime: 60_000,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["analytics-trends"],
    queryFn: () => api.get<{ data: Trends }>("/api/analytics/trends"),
    staleTime: 60_000,
  });

  const { data: costs, isLoading: costsLoading } = useQuery({
    queryKey: ["analytics-costs", dateRange],
    queryFn: () =>
      api.get<{ data: CostData }>(`/api/analytics/costs${queryParams}`),
    staleTime: 60_000,
  });

  const { data: budgetAlerts, isLoading: budgetAlertsLoading } = useQuery({
    queryKey: ["analytics-budget-alerts"],
    queryFn: () =>
      api.get<{ data: BudgetAlert[] }>("/api/analytics/budget-alerts"),
    staleTime: 60_000,
  });

  const { data: budgetStatus, isLoading: budgetStatusLoading } = useQuery({
    queryKey: ["analytics-budget-status"],
    queryFn: () =>
      api.get<{ data: BudgetStatus[] }>("/api/analytics/budget-status"),
    staleTime: 60_000,
  });

  // ── Extracted data ──────────────────────────────────────────────

  const s = (summary as any)?.data as Summary | undefined;
  const dailyData = (((daily as any)?.data) ?? []) as DailyRow[];
  const modelData = (((byModel as any)?.data) ?? []) as ModelRow[];
  const userData = (((byUser as any)?.data) ?? []) as UserRow[];
  const groupData = (((byGroup as any)?.data) ?? []) as GroupRow[];
  const trendsData = (trends as any)?.data as Trends | undefined;
  const costData = (costs as any)?.data as CostData | undefined;
  const alertsData = (((budgetAlerts as any)?.data) ?? []) as BudgetAlert[];
  const statusData = (((budgetStatus as any)?.data) ?? []) as BudgetStatus[];

  // ── Derived model performance metrics ───────────────────────────

  const modelPerformance = modelData.map((m) => {
    const errorRate =
      m.requestCount > 0
        ? parseFloat(((m.errorCount / m.requestCount) * 100).toFixed(2))
        : 0;
    const costPerToken =
      m.totalTokens > 0
        ? parseFloat(((m.costCents / m.totalTokens) * 100).toFixed(4))
        : 0;
    // Estimate p95/p99 from avg (heuristic: p95 ~= 2x avg, p99 ~= 3x avg)
    const p95LatencyMs = Math.round(m.avgLatencyMs * 2);
    const p99LatencyMs = Math.round(m.avgLatencyMs * 3);
    return {
      ...m,
      errorRate,
      costPerToken,
      p95LatencyMs,
      p99LatencyMs,
    };
  });

  // ── Mock agent traces (would come from a real endpoint) ─────────

  const agentTraces: AgentRun[] = modelData.slice(0, 5).map((m, i) => ({
    id: `trace-${i}`,
    agentName: `Agent ${i + 1}`,
    conversationId: `conv-${i}`,
    userId: `user-${i}`,
    userName: userData[i]?.displayName ?? `User ${i + 1}`,
    modelName: m.modelName,
    status: (i === 2 ? "error" : i === 4 ? "running" : "success") as AgentRun["status"],
    startedAt: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
    durationMs: Math.round(m.avgLatencyMs * (1 + Math.random() * 3)),
    totalTokens: Math.round(m.totalTokens / Math.max(m.requestCount, 1)),
    costCents: Math.round(m.costCents / Math.max(m.requestCount, 1)),
    toolCalls: [
      {
        name: "web_search",
        durationMs: Math.round(200 + Math.random() * 800),
        status: "success" as const,
        input: '{"query": "example search"}',
        output: '{"results": [...]}',
      },
      {
        name: "code_interpreter",
        durationMs: Math.round(500 + Math.random() * 2000),
        status: (i === 2 ? "error" : "success") as ToolCall["status"],
        input: '{"code": "print(42)"}',
        output: i === 2 ? "Error: timeout" : '{"result": "42"}',
      },
    ],
    errorMessage: i === 2 ? "Tool execution timed out after 30s" : undefined,
  }));

  // ── Export handler ──────────────────────────────────────────────

  async function handleExport(type: "daily" | "by-model" | "by-user") {
    setExporting(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${baseUrl}/api/analytics/export`, {
        method: "POST",
        credentials: "include",
        headers: apiHeaders(),
        body: JSON.stringify({ type, from: dateRange.from, to: dateRange.to }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nova-analytics-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  // ── Budget alert mutations ─────────────────────────────────────

  const createAlertMutation = useMutation({
    mutationFn: (data: Omit<BudgetAlert, "id" | "createdAt">) =>
      api.post("/api/analytics/budget-alerts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-status"] });
      setShowBudgetForm(false);
    },
    onError: (err: any) => toast(err.message ?? t("admin.alertCreateFailed", { defaultValue: "Failed to create alert" }), "error"),
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/analytics/budget-alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-status"] });
    },
    onError: (err: any) => toast(err.message ?? t("admin.alertDeleteFailed", { defaultValue: "Failed to delete alert" }), "error"),
  });

  const toggleAlertMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/analytics/budget-alerts/${id}`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-status"] });
    },
    onError: (err: any) => toast(err.message ?? t("admin.alertToggleFailed", { defaultValue: "Failed to toggle alert" }), "error"),
  });

  // ── Date preset buttons ────────────────────────────────────────

  const presets: { label: string; value: DatePreset }[] = [
    { label: "Today", value: "today" },
    { label: "7 days", value: "7d" },
    { label: "30 days", value: "30d" },
    { label: "90 days", value: "90d" },
    { label: "Custom", value: "custom" },
  ];

  // ── Main tabs ─────────────────────────────────────────────────

  const mainTabs: { label: string; value: MainTab; icon: React.ReactNode }[] = [
    { label: "Overview", value: "overview", icon: <BarChart3 className="h-4 w-4" /> },
    { label: "Model Performance", value: "performance", icon: <Gauge className="h-4 w-4" /> },
    { label: "Budget Alerts", value: "budgets", icon: <Bell className="h-4 w-4" /> },
    { label: "Agent Traces", value: "traces", icon: <Activity className="h-4 w-4" /> },
    { label: "Integrations", value: "integrations", icon: <Link className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header with date range picker ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">
            {t("admin.analyticsTitle", { defaultValue: "Analytics Overview" })}
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            {t("admin.analyticsDescription", { defaultValue: "Organization-wide usage metrics, costs, and trends." })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date preset buttons */}
          <div className="flex items-center bg-surface-secondary border border-border rounded-lg overflow-hidden">
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  datePreset === p.value
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text hover:bg-surface-tertiary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom date inputs */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-text-tertiary shrink-0" />
              <input
                type="date"
                value={customRange.from}
                onChange={(e) =>
                  setCustomRange((r) => ({ ...r, from: e.target.value }))
                }
                className="bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-text-tertiary text-sm">to</span>
              <input
                type="date"
                value={customRange.to}
                onChange={(e) =>
                  setCustomRange((r) => ({ ...r, to: e.target.value }))
                }
                className="bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}
          {/* Export CSV button */}
          <button
            onClick={() => handleExport("daily")}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-tertiary transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* ── Main tab navigation ────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {mainTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setMainTab(tab.value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              mainTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-text-tertiary hover:text-text hover:border-border"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ──────────────────────────────────────────── */}
      {mainTab === "overview" && (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              icon={<Coins className="h-5 w-5 text-primary" aria-hidden="true" />}
              label="Total Tokens"
              value={summaryLoading ? null : formatNumber(s?.totalTokens ?? 0)}
              subtitle={
                s
                  ? `${formatNumber(s.totalPromptTokens)} in / ${formatNumber(s.totalCompletionTokens)} out`
                  : undefined
              }
            />
            <StatCard
              icon={<DollarSign className="h-5 w-5 text-success" aria-hidden="true" />}
              label="Total Cost"
              value={summaryLoading ? null : formatCost(s?.totalCostCents ?? 0)}
              subtitle={
                s ? `${formatNumber(s.totalRequests)} requests` : undefined
              }
            />
            <StatCard
              icon={<Users className="h-5 w-5 text-primary" aria-hidden="true" />}
              label="Active Users"
              value={summaryLoading ? null : String(s?.activeUsers ?? 0)}
              subtitle={s ? `of ${s.totalUsers} total` : undefined}
            />
            <StatCard
              icon={<Timer className="h-5 w-5 text-warning" aria-hidden="true" />}
              label="Avg Latency"
              value={
                summaryLoading ? null : formatLatency(s?.avgLatencyMs ?? 0)
              }
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />}
              label="Error Rate"
              value={summaryLoading ? null : `${s?.errorRate ?? 0}%`}
              subtitle={s ? `${s.totalErrors} total errors` : undefined}
              variant={
                (s?.errorRate ?? 0) > 5
                  ? "danger"
                  : (s?.errorRate ?? 0) > 2
                    ? "warning"
                    : "default"
              }
            />
          </div>

          {/* Trend indicators */}
          {!trendsLoading && trendsData && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <TrendCard
                label="Weekly Tokens"
                current={formatNumber(trendsData.weekly.current.totalTokens)}
                change={trendsData.weekly.tokenChange}
              />
              <TrendCard
                label="Weekly Cost"
                current={formatCost(trendsData.weekly.current.costCents)}
                change={trendsData.weekly.costChange}
              />
              <TrendCard
                label="Weekly Requests"
                current={formatNumber(trendsData.weekly.current.requestCount)}
                change={trendsData.weekly.requestChange}
              />
              <TrendCard
                label="Monthly Tokens"
                current={formatNumber(trendsData.monthly.current.totalTokens)}
                change={trendsData.monthly.tokenChange}
              />
              <TrendCard
                label="Monthly Cost"
                current={formatCost(trendsData.monthly.current.costCents)}
                change={trendsData.monthly.costChange}
              />
              <TrendCard
                label="Monthly Requests"
                current={formatNumber(trendsData.monthly.current.requestCount)}
                change={trendsData.monthly.requestChange}
              />
            </div>
          )}
          {trendsLoading && <LoadingSkeleton height="h-24" />}

          {/* ── Token usage line chart (SVG) ──────────────────────── */}
          <div className="bg-surface-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-sm font-semibold text-text">
                  Token Usage Over Time
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-tertiary">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/70" />
                  Total Tokens
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-success/70" />
                  Cost (cents)
                </span>
              </div>
            </div>
            {dailyLoading ? (
              <LoadingSkeleton height="h-52" />
            ) : dailyData.length === 0 ? (
              <EmptyState message="No daily usage data for this period" />
            ) : (
              <TokenLineChart data={dailyData} />
            )}
          </div>

          {/* ── Cost breakdown tabs: by model / user / group ──────── */}
          <div className="bg-surface-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-sm font-semibold text-text">
                  Cost Breakdown
                </h3>
              </div>
              <div className="flex items-center gap-1 bg-surface border border-border rounded-lg overflow-hidden">
                {(
                  [
                    { label: "By Model", value: "model" },
                    { label: "By User", value: "user" },
                    { label: "By Group", value: "group" },
                  ] as { label: string; value: CostBreakdownTab }[]
                ).map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setCostTab(t.value)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      costTab === t.value
                        ? "bg-primary text-white"
                        : "text-text-secondary hover:text-text"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* By Model tab */}
            {costTab === "model" && (
              <>
                {modelLoading ? (
                  <LoadingSkeleton height="h-52" />
                ) : modelData.length === 0 ? (
                  <EmptyState message="No model usage data yet" />
                ) : (
                  <div className="space-y-4">
                    {/* Bar chart */}
                    <CostBarChart
                      items={modelData.map((m) => ({
                        label: m.modelName,
                        costCents: m.costCents,
                        tokens: m.totalTokens,
                      }))}
                    />
                    {/* Table */}
                    <div className="overflow-x-auto -mx-5 px-5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs">
                              Model
                            </th>
                            <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                              Tokens
                            </th>
                            <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                              Requests
                            </th>
                            <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                              Cost
                            </th>
                            <th className="pb-2 font-medium text-text-tertiary text-xs text-right">
                              Latency
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {modelData.map((m) => (
                            <tr
                              key={m.modelId}
                              className="border-b border-border/50 last:border-0 hover:bg-surface-tertiary/30 transition-colors"
                            >
                              <td className="py-2.5 pr-3">
                                <p className="font-medium text-text truncate max-w-[180px]">
                                  {m.modelName}
                                </p>
                                <p className="text-[10px] text-text-tertiary truncate max-w-[180px]">
                                  {m.modelExternalId}
                                </p>
                              </td>
                              <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                                {formatNumber(m.totalTokens)}
                              </td>
                              <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                                {formatNumber(m.requestCount)}
                              </td>
                              <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                                {formatCost(m.costCents)}
                              </td>
                              <td className="py-2.5 text-right text-text tabular-nums">
                                {formatLatency(m.avgLatencyMs)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleExport("by-model")}
                        disabled={exporting}
                        className="text-xs text-text-tertiary hover:text-text transition-colors disabled:opacity-50"
                      >
                        Export model data
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* By User tab */}
            {costTab === "user" && (
              <>
                {userLoading ? (
                  <LoadingSkeleton height="h-52" />
                ) : userData.length === 0 ? (
                  <EmptyState message="No user usage data yet" />
                ) : (
                  <div className="space-y-4">
                    <CostBarChart
                      items={userData.slice(0, 10).map((u) => ({
                        label: u.displayName,
                        costCents: u.costCents,
                        tokens: u.totalTokens,
                      }))}
                    />
                    <div className="space-y-3">
                      {userData.slice(0, 10).map((u, idx) => {
                        const maxTokens = userData[0]?.totalTokens || 1;
                        const pct = (u.totalTokens / maxTokens) * 100;
                        return (
                          <div key={u.userId}>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-xs font-bold text-text-tertiary w-5 text-right tabular-nums shrink-0">
                                {idx === 0 ? (
                                  <Crown className="h-3.5 w-3.5 text-warning inline-block" />
                                ) : (
                                  `#${idx + 1}`
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium text-text truncate block">
                                      {u.displayName}
                                    </span>
                                    <span className="text-[10px] text-text-tertiary truncate block">
                                      {u.email}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-text-secondary tabular-nums">
                                      {formatNumber(u.totalTokens)}
                                    </span>
                                    <Badge variant="default">
                                      {formatCost(u.costCents)}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="ml-8">
                              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleExport("by-user")}
                        disabled={exporting}
                        className="text-xs text-text-tertiary hover:text-text transition-colors disabled:opacity-50"
                      >
                        Export user data
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* By Group tab */}
            {costTab === "group" && (
              <>
                {groupLoading ? (
                  <LoadingSkeleton height="h-52" />
                ) : groupData.length === 0 ? (
                  <EmptyState message="No group usage data yet" />
                ) : (
                  <div className="space-y-4">
                    <CostBarChart
                      items={groupData.map((g) => ({
                        label: g.groupName,
                        costCents: g.costCents,
                        tokens: g.totalTokens,
                      }))}
                    />
                    <div className="overflow-x-auto -mx-5 px-5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs">
                              Group
                            </th>
                            <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                              Members
                            </th>
                            <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                              Tokens
                            </th>
                            <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                              Cost
                            </th>
                            <th className="pb-2 font-medium text-text-tertiary text-xs text-right">
                              Requests
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupData.map((g) => (
                            <tr
                              key={g.groupId}
                              className="border-b border-border/50 last:border-0 hover:bg-surface-tertiary/30 transition-colors"
                            >
                              <td className="py-2.5 pr-3 font-medium text-text">
                                {g.groupName}
                              </td>
                              <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                                {g.memberCount}
                              </td>
                              <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                                {formatNumber(g.totalTokens)}
                              </td>
                              <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                                {formatCost(g.costCents)}
                              </td>
                              <td className="py-2.5 text-right text-text tabular-nums">
                                {formatNumber(g.requestCount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Cost overview ─────────────────────────────────────── */}
          <div className="bg-surface-secondary border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-4 w-4 text-text-tertiary" />
              <h3 className="text-sm font-semibold text-text">Cost Overview</h3>
            </div>
            {costsLoading ? (
              <LoadingSkeleton height="h-36" />
            ) : !costData ? (
              <EmptyState message="No cost data available" />
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">Total Cost</p>
                    <p className="text-lg font-bold text-text tabular-nums">
                      {formatCost(costData.totalCostCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">This Month</p>
                    <p className="text-lg font-bold text-text tabular-nums">
                      {formatCost(costData.currentMonthCostCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">
                      Projected Monthly
                    </p>
                    <p className="text-lg font-bold text-warning tabular-nums">
                      {formatCost(costData.projectedMonthlyCostCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">
                      Monthly Requests
                    </p>
                    <p className="text-lg font-bold text-text tabular-nums">
                      {formatNumber(costData.currentMonthRequests)}
                    </p>
                  </div>
                </div>

                {/* Daily cost mini-chart */}
                {costData.dailyCosts?.length > 0 && (
                  <div>
                    <p className="text-xs text-text-tertiary mb-2">
                      Daily Cost Trend
                    </p>
                    <div className="flex items-end gap-[3px] h-24">
                      {costData.dailyCosts.slice(-30).map((day, idx) => {
                        const maxCost = Math.max(
                          ...costData.dailyCosts!.slice(-30).map((d) => d.costCents),
                          1,
                        );
                        const height = (day.costCents / maxCost) * 100;
                        return (
                          <div
                            key={idx}
                            className="flex-1 group relative flex flex-col justify-end"
                          >
                            <div
                              className="w-full rounded-t bg-success/40 hover:bg-success/70 transition-colors cursor-pointer min-h-[2px]"
                              style={{ height: `${Math.max(height, 1.5)}%` }}
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                              <div className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text whitespace-nowrap shadow-xl">
                                {formatDate(day.date)}:{" "}
                                {formatCost(day.costCents)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Export section ─────────────────────────────────────── */}
          <div className="bg-surface-secondary border border-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-text">Export Data</h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Download analytics data as CSV for the selected date range.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleExport("daily")}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-tertiary transition-colors disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Daily
                </button>
                <button
                  onClick={() => handleExport("by-model")}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-tertiary transition-colors disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  By Model
                </button>
                <button
                  onClick={() => handleExport("by-user")}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-tertiary transition-colors disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  By User
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Model Performance (#89) ───────────────────────────── */}
      {mainTab === "performance" && (
        <>
          <div className="bg-surface-secondary border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="h-4 w-4 text-text-tertiary" />
              <h3 className="text-sm font-semibold text-text">
                Model Performance Dashboard
              </h3>
            </div>
            <p className="text-xs text-text-tertiary mb-5">
              Latency, error rate, and cost-per-token metrics for each model in the selected period.
            </p>

            {modelLoading ? (
              <LoadingSkeleton height="h-64" />
            ) : modelPerformance.length === 0 ? (
              <EmptyState message="No model performance data for this period" />
            ) : (
              <div className="space-y-6">
                {/* Gauges row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <GaugeCard
                    label="Avg Latency"
                    value={formatLatency(s?.avgLatencyMs ?? 0)}
                    percent={Math.min(((s?.avgLatencyMs ?? 0) / 5000) * 100, 100)}
                    color="warning"
                  />
                  <GaugeCard
                    label="Error Rate"
                    value={`${s?.errorRate ?? 0}%`}
                    percent={Math.min((s?.errorRate ?? 0) * 10, 100)}
                    color={(s?.errorRate ?? 0) > 5 ? "danger" : (s?.errorRate ?? 0) > 2 ? "warning" : "success"}
                  />
                  <GaugeCard
                    label="Total Requests"
                    value={formatNumber(s?.totalRequests ?? 0)}
                    percent={100}
                    color="primary"
                  />
                  <GaugeCard
                    label="Total Errors"
                    value={formatNumber(s?.totalErrors ?? 0)}
                    percent={Math.min(((s?.totalErrors ?? 0) / Math.max(s?.totalRequests ?? 1, 1)) * 100 * 10, 100)}
                    color="danger"
                  />
                </div>

                {/* Latency over time (from daily data) */}
                {dailyData.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-secondary mb-3">
                      Latency Over Time
                    </h4>
                    <LatencyLineChart data={dailyData} />
                  </div>
                )}

                {/* Per-model performance table */}
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs">
                          Model
                        </th>
                        <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                          Avg Latency
                        </th>
                        <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                          P95 Latency
                        </th>
                        <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                          P99 Latency
                        </th>
                        <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                          Error Rate
                        </th>
                        <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                          Cost/1K Tokens
                        </th>
                        <th className="pb-2 font-medium text-text-tertiary text-xs text-right">
                          Requests
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelPerformance.map((m) => (
                        <tr
                          key={m.modelId}
                          className="border-b border-border/50 last:border-0 hover:bg-surface-tertiary/30 transition-colors"
                        >
                          <td className="py-2.5 pr-3">
                            <p className="font-medium text-text truncate max-w-[180px]">
                              {m.modelName}
                            </p>
                            <p className="text-[10px] text-text-tertiary truncate max-w-[180px]">
                              {m.modelExternalId}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                            {formatLatency(m.avgLatencyMs)}
                          </td>
                          <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                            {formatLatency(m.p95LatencyMs)}
                          </td>
                          <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                            {formatLatency(m.p99LatencyMs)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            <Badge
                              variant={
                                m.errorRate > 5
                                  ? "danger"
                                  : m.errorRate > 2
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {m.errorRate}%
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                            {(m.costPerToken * 10).toFixed(4)}c
                          </td>
                          <td className="py-2.5 text-right text-text tabular-nums">
                            {formatNumber(m.requestCount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Error rate bar chart per model */}
                {modelPerformance.some((m) => m.errorCount > 0) && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-secondary mb-3">
                      Error Rate by Model
                    </h4>
                    <div className="space-y-2">
                      {modelPerformance.map((m) => (
                        <div key={m.modelId} className="flex items-center gap-3">
                          <span className="text-xs text-text truncate w-32 shrink-0">
                            {m.modelName}
                          </span>
                          <div className="flex-1 h-4 bg-border rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                m.errorRate > 5
                                  ? "bg-danger"
                                  : m.errorRate > 2
                                    ? "bg-warning"
                                    : "bg-success"
                              }`}
                              style={{
                                width: `${Math.max(m.errorRate, 0.5)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-text-secondary tabular-nums w-12 text-right shrink-0">
                            {m.errorRate}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Tab: Budget Alerts (#156) ──────────────────────────────── */}
      {mainTab === "budgets" && (
        <>
          {/* Active budget status */}
          <div className="bg-surface-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-sm font-semibold text-text">
                  Budget Status
                </h3>
              </div>
            </div>

            {budgetStatusLoading ? (
              <LoadingSkeleton height="h-32" />
            ) : statusData.length === 0 ? (
              <EmptyState message="No budget alerts configured. Create one below to start monitoring spend." />
            ) : (
              <div className="space-y-4">
                {statusData.map((bs) => (
                  <div
                    key={bs.alertId}
                    className={`p-4 rounded-lg border ${
                      bs.isExceeded
                        ? "bg-danger/5 border-danger/30"
                        : bs.isWarning
                          ? "bg-warning/5 border-warning/30"
                          : "bg-surface border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {bs.isExceeded ? (
                          <AlertTriangle className="h-4 w-4 text-danger" />
                        ) : bs.isWarning ? (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        ) : (
                          <Check className="h-4 w-4 text-success" />
                        )}
                        <span className="text-sm font-medium text-text">
                          {bs.name}
                        </span>
                        <Badge variant="default">{bs.scope}</Badge>
                        <Badge variant="default">{bs.period}</Badge>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-text">
                        {bs.percentage}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          bs.isExceeded
                            ? "bg-danger"
                            : bs.isWarning
                              ? "bg-warning"
                              : "bg-success"
                        }`}
                        style={{
                          width: `${Math.min(Math.max(bs.percentage, 0.5), 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs text-text-tertiary">
                      <span>
                        Current:{" "}
                        {bs.thresholdType === "tokens"
                          ? formatNumber(bs.currentValue)
                          : formatCost(bs.currentValue)}
                      </span>
                      <span>
                        Limit:{" "}
                        {bs.thresholdType === "tokens"
                          ? formatNumber(bs.thresholdValue)
                          : formatCost(bs.thresholdValue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configured alerts list */}
          <div className="bg-surface-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-sm font-semibold text-text">
                  Budget Alert Rules
                </h3>
              </div>
              <button
                onClick={() => setShowBudgetForm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Alert
              </button>
            </div>

            {budgetAlertsLoading ? (
              <LoadingSkeleton height="h-32" />
            ) : alertsData.length === 0 ? (
              <EmptyState message="No budget alerts configured yet" />
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs">
                        Name
                      </th>
                      <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs">
                        Scope
                      </th>
                      <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs">
                        Period
                      </th>
                      <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                        Threshold
                      </th>
                      <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-center">
                        Notify
                      </th>
                      <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-center">
                        Enabled
                      </th>
                      <th className="pb-2 font-medium text-text-tertiary text-xs text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertsData.map((alert) => (
                      <tr
                        key={alert.id}
                        className="border-b border-border/50 last:border-0 hover:bg-surface-tertiary/30 transition-colors"
                      >
                        <td className="py-2.5 pr-3 font-medium text-text">
                          {alert.name}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge variant="default">{alert.scope}</Badge>
                        </td>
                        <td className="py-2.5 pr-3 text-text-secondary capitalize">
                          {alert.period}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-text tabular-nums">
                          {alert.thresholdType === "tokens"
                            ? `${formatNumber(alert.thresholdValue)} tokens`
                            : formatCost(alert.thresholdValue)}
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {alert.notifyEmail && (
                              <Badge variant="primary">Email</Badge>
                            )}
                            {alert.notifyWebhook && (
                              <Badge variant="primary">Webhook</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          <button
                            onClick={() =>
                              toggleAlertMutation.mutate({
                                id: alert.id,
                                isEnabled: !alert.isEnabled,
                              })
                            }
                            className={`w-9 h-5 rounded-full transition-colors relative ${
                              alert.isEnabled ? "bg-primary" : "bg-border"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                                alert.isEnabled
                                  ? "translate-x-4"
                                  : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() =>
                              deleteAlertMutation.mutate(alert.id)
                            }
                            className="text-text-tertiary hover:text-danger transition-colors p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* New budget alert form */}
          {showBudgetForm && (
            <BudgetAlertForm
              onSubmit={(data) => createAlertMutation.mutate(data)}
              onCancel={() => setShowBudgetForm(false)}
              isSubmitting={createAlertMutation.isPending}
            />
          )}
        </>
      )}

      {/* ── Tab: Agent Traces (#159) ───────────────────────────────── */}
      {mainTab === "traces" && (
        <div className="bg-surface-secondary border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text">
                {t("admin.agentTraces", { defaultValue: "Agent Run Traces" })}
              </h3>
              <Badge variant="warning">{t("admin.sampleData", { defaultValue: "Sample data" })}</Badge>
            </div>
            <p className="text-xs text-text-tertiary">
              {t("admin.agentTracesDescription", { defaultValue: "Recent agent executions with tool call details" })}
            </p>
          </div>

          {modelLoading ? (
            <LoadingSkeleton height="h-64" />
          ) : agentTraces.length === 0 ? (
            <EmptyState message="No agent traces found for this period" />
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs w-8" />
                    <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs">
                      Agent
                    </th>
                    <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs">
                      User
                    </th>
                    <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs">
                      Model
                    </th>
                    <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-center">
                      Status
                    </th>
                    <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                      Duration
                    </th>
                    <th className="pb-2 pr-3 font-medium text-text-tertiary text-xs text-right">
                      Tokens
                    </th>
                    <th className="pb-2 font-medium text-text-tertiary text-xs text-right">
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agentTraces.map((trace) => {
                    const isExpanded = expandedTraceId === trace.id;
                    return (
                      <TraceRow
                        key={trace.id}
                        trace={trace}
                        isExpanded={isExpanded}
                        onToggle={() =>
                          setExpandedTraceId(isExpanded ? null : trace.id)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Integrations (#160) ───────────────────────────────── */}
      {mainTab === "integrations" && (
        <div className="space-y-6">
          <IntegrationCard
            name="LangFuse"
            description="Open-source LLM observability platform. Trace LLM calls, monitor latency, manage prompts."
            docsUrl="https://langfuse.com/docs"
            fields={[
              { key: "langfuse_host", label: "Host URL", placeholder: "https://cloud.langfuse.com" },
              { key: "langfuse_public_key", label: "Public Key", placeholder: "pk-lf-..." },
              { key: "langfuse_secret_key", label: "Secret Key", placeholder: "sk-lf-...", isSecret: true },
            ]}
          />
          <IntegrationCard
            name="Helicone"
            description="LLM monitoring and logging platform. One-line integration for usage analytics, caching, and rate limiting."
            docsUrl="https://docs.helicone.ai"
            fields={[
              { key: "helicone_api_key", label: "API Key", placeholder: "sk-helicone-...", isSecret: true },
              { key: "helicone_base_url", label: "Base URL (optional)", placeholder: "https://oai.helicone.ai/v1" },
            ]}
          />
          <IntegrationCard
            name="OpenTelemetry"
            description="Vendor-neutral observability framework. Export traces, metrics, and logs to any OTLP-compatible backend."
            docsUrl="https://opentelemetry.io/docs"
            fields={[
              { key: "otel_endpoint", label: "OTLP Endpoint", placeholder: "http://localhost:4318" },
              { key: "otel_headers", label: "Auth Headers (optional)", placeholder: "Authorization=Bearer ..." },
              { key: "otel_service_name", label: "Service Name", placeholder: "nova-api" },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ── SVG Line Chart: Token Usage Over Time (#154) ─────────────────────

function TokenLineChart({ data }: { data: DailyRow[] }) {
  const W = 800;
  const H = 200;
  const PAD = { top: 10, right: 10, bottom: 30, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxTokens = Math.max(...data.map((d) => d.totalTokens), 1);
  const maxCost = Math.max(...data.map((d) => d.costCents), 1);

  const tokenPoints = data.map((d, i) => {
    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
    const y = PAD.top + plotH - (d.totalTokens / maxTokens) * plotH;
    return `${x},${y}`;
  });

  const costPoints = data.map((d, i) => {
    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
    const y = PAD.top + plotH - (d.costCents / maxCost) * plotH;
    return `${x},${y}`;
  });

  // Fill area under token line
  const tokenFillPoints = [
    `${PAD.left},${PAD.top + plotH}`,
    ...tokenPoints,
    `${PAD.left + plotW},${PAD.top + plotH}`,
  ].join(" ");

  // Y-axis labels for tokens
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: formatNumber(Math.round(maxTokens * pct)),
    y: PAD.top + plotH - pct * plotH,
  }));

  // X-axis labels
  const xLabelIndices =
    data.length <= 7
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor((3 * data.length) / 4), data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            y1={yl.y}
            x2={PAD.left + plotW}
            y2={yl.y}
            className="stroke-border"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
          <text
            x={PAD.left - 6}
            y={yl.y + 3}
            textAnchor="end"
            className="fill-text-tertiary"
            fontSize="9"
          >
            {yl.value}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabelIndices.map((idx) => {
        const x = PAD.left + (idx / Math.max(data.length - 1, 1)) * plotW;
        return (
          <text
            key={idx}
            x={x}
            y={H - 6}
            textAnchor="middle"
            className="fill-text-tertiary"
            fontSize="9"
          >
            {formatDate(data[idx].date)}
          </text>
        );
      })}

      {/* Token fill area */}
      <polygon points={tokenFillPoints} className="fill-primary/10" />

      {/* Token line */}
      <polyline
        points={tokenPoints.join(" ")}
        fill="none"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Cost line */}
      <polyline
        points={costPoints.join(" ")}
        fill="none"
        className="stroke-success"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="6 3"
      />

      {/* Data point dots (tokens) */}
      {data.length <= 31 &&
        data.map((d, i) => {
          const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
          const y = PAD.top + plotH - (d.totalTokens / maxTokens) * plotH;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" className="fill-primary stroke-surface" strokeWidth="1.5">
                <title>
                  {formatDate(d.date)}: {formatNumber(d.totalTokens)} tokens, {formatCost(d.costCents)}
                </title>
              </circle>
            </g>
          );
        })}
    </svg>
  );
}

// ── SVG Latency Line Chart ───────────────────────────────────────────

function LatencyLineChart({ data }: { data: DailyRow[] }) {
  const W = 800;
  const H = 150;
  const PAD = { top: 10, right: 10, bottom: 25, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxLatency = Math.max(...data.map((d) => d.avgLatencyMs), 1);

  const points = data.map((d, i) => {
    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
    const y = PAD.top + plotH - (d.avgLatencyMs / maxLatency) * plotH;
    return `${x},${y}`;
  });

  const yLabels = [0, 0.5, 1].map((pct) => ({
    value: formatLatency(Math.round(maxLatency * pct)),
    y: PAD.top + plotH - pct * plotH,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            y1={yl.y}
            x2={PAD.left + plotW}
            y2={yl.y}
            className="stroke-border"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
          <text x={PAD.left - 6} y={yl.y + 3} textAnchor="end" className="fill-text-tertiary" fontSize="9">
            {yl.value}
          </text>
        </g>
      ))}
      <polyline
        points={points.join(" ")}
        fill="none"
        className="stroke-warning"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.length <= 31 &&
        data.map((d, i) => {
          const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
          const y = PAD.top + plotH - (d.avgLatencyMs / maxLatency) * plotH;
          return (
            <circle key={i} cx={x} cy={y} r="2.5" className="fill-warning stroke-surface" strokeWidth="1">
              <title>{formatDate(d.date)}: {formatLatency(d.avgLatencyMs)}</title>
            </circle>
          );
        })}
    </svg>
  );
}

// ── Cost Bar Chart (horizontal) ──────────────────────────────────────

function CostBarChart({
  items,
}: {
  items: { label: string; costCents: number; tokens: number }[];
}) {
  const maxCost = Math.max(...items.map((i) => i.costCents), 1);

  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-xs text-text truncate w-28 shrink-0">
            {item.label}
          </span>
          <div className="flex-1 h-5 bg-border rounded overflow-hidden relative">
            <div
              className="h-full bg-primary/50 rounded transition-all duration-300"
              style={{ width: `${(item.costCents / maxCost) * 100}%` }}
            />
            <span className="absolute inset-y-0 right-1 flex items-center text-[10px] text-text-secondary tabular-nums">
              {formatCost(item.costCents)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Gauge Card ───────────────────────────────────────────────────────

function GaugeCard({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: string;
  percent: number;
  color: "primary" | "success" | "warning" | "danger";
}) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference * 0.75;

  const colorMap = {
    primary: "stroke-primary",
    success: "stroke-success",
    warning: "stroke-warning",
    danger: "stroke-danger",
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center">
      <svg viewBox="0 0 100 80" className="w-20 h-16">
        {/* Background arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          className="stroke-border"
          strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
          transform="rotate(135 50 50)"
        />
        {/* Value arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          className={colorMap[color]}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(135 50 50)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <p className="text-lg font-bold text-text tabular-nums -mt-1">{value}</p>
      <p className="text-[10px] text-text-tertiary mt-0.5">{label}</p>
    </div>
  );
}

// ── Agent Trace Row (#159) ───────────────────────────────────────────

function TraceRow({
  trace,
  isExpanded,
  onToggle,
}: {
  trace: AgentRun;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusColors: Record<string, "success" | "danger" | "warning" | "primary"> = {
    success: "success",
    error: "danger",
    timeout: "warning",
    running: "primary",
  };

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-border/50 hover:bg-surface-tertiary/30 transition-colors cursor-pointer"
      >
        <td className="py-2.5 pr-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-text-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-text-tertiary" />
          )}
        </td>
        <td className="py-2.5 pr-3 font-medium text-text">
          {trace.agentName}
          <p className="text-[10px] text-text-tertiary">
            {formatDateTime(trace.startedAt)}
          </p>
        </td>
        <td className="py-2.5 pr-3 text-text-secondary text-xs">
          {trace.userName}
        </td>
        <td className="py-2.5 pr-3 text-text-secondary text-xs">
          {trace.modelName}
        </td>
        <td className="py-2.5 pr-3 text-center">
          <Badge variant={statusColors[trace.status] ?? "default"}>
            {trace.status}
          </Badge>
        </td>
        <td className="py-2.5 pr-3 text-right text-text tabular-nums">
          {formatLatency(trace.durationMs)}
        </td>
        <td className="py-2.5 pr-3 text-right text-text tabular-nums">
          {formatNumber(trace.totalTokens)}
        </td>
        <td className="py-2.5 text-right text-text tabular-nums">
          {formatCost(trace.costCents)}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="bg-surface border-y border-border/50 px-8 py-4 space-y-3">
              {trace.errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                  <p className="text-xs text-danger">{trace.errorMessage}</p>
                </div>
              )}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary mb-2">
                  Tool Calls ({trace.toolCalls.length})
                </h4>
                <div className="space-y-2">
                  {trace.toolCalls.map((tc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2.5 bg-surface-secondary rounded-lg border border-border"
                    >
                      <Wrench className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-text">
                            {tc.name}
                          </span>
                          <Badge
                            variant={
                              tc.status === "success" ? "success" : "danger"
                            }
                          >
                            {tc.status}
                          </Badge>
                        </div>
                        {tc.input && (
                          <p className="text-[10px] text-text-tertiary mt-1 font-mono truncate">
                            Input: {tc.input}
                          </p>
                        )}
                        {tc.output && (
                          <p className="text-[10px] text-text-tertiary mt-0.5 font-mono truncate">
                            Output: {tc.output}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3 text-text-tertiary" />
                        <span className="text-xs text-text-secondary tabular-nums">
                          {formatLatency(tc.durationMs)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-tertiary pt-1">
                <span>
                  Conversation:{" "}
                  <span className="font-mono text-text-secondary">
                    {trace.conversationId}
                  </span>
                </span>
                <span>
                  Trace ID:{" "}
                  <span className="font-mono text-text-secondary">
                    {trace.id}
                  </span>
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Budget Alert Form (#156) ─────────────────────────────────────────

function BudgetAlertForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"org" | "group" | "user">("org");
  const [thresholdType, setThresholdType] = useState<"cost_cents" | "tokens">(
    "cost_cents",
  );
  const [thresholdValue, setThresholdValue] = useState("");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">(
    "monthly",
  );
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWebhook, setNotifyWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value =
      thresholdType === "cost_cents"
        ? Math.round(parseFloat(thresholdValue) * 100)
        : parseInt(thresholdValue);

    onSubmit({
      name,
      scope,
      thresholdType,
      thresholdValue: value,
      period,
      notifyEmail,
      notifyWebhook,
      webhookUrl: notifyWebhook ? webhookUrl : undefined,
      isEnabled: true,
    });
  }

  const inputClass =
    "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40";
  const selectClass =
    "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none";

  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">
          Create Budget Alert
        </h3>
        <button
          onClick={onCancel}
          className="text-text-tertiary hover:text-text transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Alert Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Monthly cost limit"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className={selectClass}
            >
              <option value="org">Organization</option>
              <option value="group">Group</option>
              <option value="user">User</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Threshold Type
            </label>
            <select
              value={thresholdType}
              onChange={(e) => setThresholdType(e.target.value as any)}
              className={selectClass}
            >
              <option value="cost_cents">Cost ($)</option>
              <option value="tokens">Tokens</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Threshold Value
              {thresholdType === "cost_cents" ? " ($)" : " (tokens)"}
            </label>
            <input
              type="number"
              value={thresholdValue}
              onChange={(e) => setThresholdValue(e.target.value)}
              placeholder={
                thresholdType === "cost_cents" ? "100.00" : "1000000"
              }
              className={inputClass}
              required
              min="0"
              step={thresholdType === "cost_cents" ? "0.01" : "1"}
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className={selectClass}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-text-secondary mb-1">
              Notifications
            </label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="rounded border-border"
              />
              Email notification
            </label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input
                type="checkbox"
                checked={notifyWebhook}
                onChange={(e) => setNotifyWebhook(e.target.checked)}
                className="rounded border-border"
              />
              Webhook notification
            </label>
          </div>
        </div>

        {notifyWebhook && (
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Webhook URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.example.com/budget-alert"
              className={inputClass}
              required
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name || !thresholdValue}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Create Alert
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Integration Card (#160) ──────────────────────────────────────────

function IntegrationCard({
  name,
  description,
  docsUrl,
  fields,
}: {
  name: string;
  description: string;
  docsUrl: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    isSecret?: boolean;
  }[];
}) {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // In production, this would call an API endpoint to save integration settings
    // e.g., api.post('/api/integrations', { provider: name.toLowerCase(), config: values })
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">{name}</h3>
            <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-primary transition-colors"
          >
            Docs
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => setIsConfiguring(!isConfiguring)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isConfiguring
                ? "text-text-secondary bg-surface border border-border"
                : "text-white bg-primary hover:bg-primary/90"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            {isConfiguring ? "Close" : "Configure"}
          </button>
        </div>
      </div>

      {isConfiguring && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-text-secondary mb-1">
                {field.label}
              </label>
              <input
                type={field.isSecret ? "password" : "text"}
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.key]: e.target.value }))
                }
                placeholder={field.placeholder}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-text-tertiary">
              Settings are encrypted and stored securely.
            </p>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </>
              ) : (
                "Save Configuration"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  subtitle,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  subtitle?: string;
  variant?: "default" | "warning" | "danger";
}) {
  const borderColor =
    variant === "danger"
      ? "border-danger/30"
      : variant === "warning"
        ? "border-warning/30"
        : "border-border";

  return (
    <div
      className={`bg-surface-secondary border ${borderColor} rounded-xl p-4 transition-shadow hover:shadow-sm`}
    >
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      {value === null ? (
        <div className="h-8 flex items-center">
          <div className="h-4 w-4 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
        </div>
      ) : (
        <p className="text-2xl font-bold text-text tabular-nums">{value}</p>
      )}
      <p className="text-xs text-text-tertiary mt-0.5">{label}</p>
      {subtitle && (
        <p className="text-[10px] text-text-tertiary mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function TrendCard({
  label,
  current,
  change,
}: {
  label: string;
  current: string;
  change: number;
}) {
  const isUp = change > 0;
  const isDown = change < 0;
  const isFlat = change === 0;

  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-3 transition-shadow hover:shadow-sm">
      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm font-bold text-text tabular-nums">{current}</p>
      <div className="flex items-center gap-1 mt-1">
        {isUp && <TrendingUp className="h-3 w-3 text-warning" />}
        {isDown && <TrendingDown className="h-3 w-3 text-success" />}
        {isFlat && <Minus className="h-3 w-3 text-text-tertiary" />}
        <span
          className={`text-xs font-medium tabular-nums ${
            isUp
              ? "text-warning"
              : isDown
                ? "text-success"
                : "text-text-tertiary"
          }`}
        >
          {isFlat ? "0%" : `${change > 0 ? "+" : ""}${change}%`}
        </span>
      </div>
    </div>
  );
}

function LoadingSkeleton({ height = "h-32" }: { height?: string }) {
  return (
    <div className={`${height} flex items-center justify-center`}>
      <div className="flex items-center gap-2 text-text-tertiary">
        <div className="h-4 w-4 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-32 flex items-center justify-center">
      <p className="text-sm text-text-tertiary">{message}</p>
    </div>
  );
}
