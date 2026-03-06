import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";

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
  return `${ms}ms`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [exporting, setExporting] = useState(false);

  const queryParams = `?from=${dateRange.from}&to=${dateRange.to}`;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics-summary", dateRange],
    queryFn: () =>
      api.get<{ data: Summary }>(`/api/analytics/summary${queryParams}`),
    staleTime: 60_000,
  });

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ["analytics-daily"],
    queryFn: () =>
      api.get<{ data: DailyRow[] }>("/api/analytics/daily?days=30"),
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

  const s = (summary as any)?.data as Summary | undefined;
  const dailyData = (((daily as any)?.data) ?? []) as DailyRow[];
  const modelData = (((byModel as any)?.data) ?? []) as ModelRow[];
  const userData = (((byUser as any)?.data) ?? []) as UserRow[];
  const trendsData = (trends as any)?.data as Trends | undefined;
  const costData = (costs as any)?.data as CostData | undefined;

  async function handleExport(type: "daily" | "by-model" | "by-user") {
    setExporting(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${baseUrl}/api/analytics/export`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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

  return (
    <div className="space-y-6">
      {/* ── Header with date range picker ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">
            Analytics Overview
          </h2>
          <p className="text-sm text-text-secondary">
            Organization-wide usage metrics, costs, and trends.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-text-tertiary shrink-0" />
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) =>
              setDateRange((r) => ({ ...r, from: e.target.value }))
            }
            className="bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="text-text-tertiary text-sm">to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) =>
              setDateRange((r) => ({ ...r, to: e.target.value }))
            }
            className="bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* ── Summary stat cards (5 across) ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Coins className="h-5 w-5 text-primary" />}
          label="Total Tokens"
          value={summaryLoading ? null : formatNumber(s?.totalTokens ?? 0)}
          subtitle={
            s
              ? `${formatNumber(s.totalPromptTokens)} in / ${formatNumber(s.totalCompletionTokens)} out`
              : undefined
          }
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-success" />}
          label="Total Cost"
          value={summaryLoading ? null : formatCost(s?.totalCostCents ?? 0)}
          subtitle={
            s ? `${formatNumber(s.totalRequests)} requests` : undefined
          }
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-primary" />}
          label="Active Users"
          value={summaryLoading ? null : String(s?.activeUsers ?? 0)}
          subtitle={s ? `of ${s.totalUsers} total` : undefined}
        />
        <StatCard
          icon={<Timer className="h-5 w-5 text-warning" />}
          label="Avg Latency"
          value={
            summaryLoading ? null : formatLatency(s?.avgLatencyMs ?? 0)
          }
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-danger" />}
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

      {/* ── Trend indicators (WoW) ─────────────────────────────────── */}
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

      {/* ── Daily usage bar chart ──────────────────────────────────── */}
      <div className="bg-surface-secondary border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text">
              Daily Usage (Last 30 Days)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/60" />
              Tokens
            </span>
          </div>
        </div>
        {dailyLoading ? (
          <LoadingSkeleton height="h-48" />
        ) : dailyData.length === 0 ? (
          <EmptyState message="No daily usage data for this period" />
        ) : (
          <div className="space-y-2">
            <div className="flex items-end gap-[3px] h-48">
              {dailyData.map((day, idx) => {
                const maxTokens = Math.max(
                  ...dailyData.map((d) => d.totalTokens),
                  1,
                );
                const height = (day.totalTokens / maxTokens) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 group relative flex flex-col justify-end"
                  >
                    <div
                      className="w-full rounded-t bg-primary/50 hover:bg-primary transition-colors cursor-pointer min-h-[2px]"
                      style={{ height: `${Math.max(height, 1.5)}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                      <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text whitespace-nowrap shadow-xl">
                        <p className="font-semibold mb-1">
                          {formatDate(day.date)}
                        </p>
                        <p>{formatNumber(day.totalTokens)} tokens</p>
                        <p>{formatCost(day.costCents)}</p>
                        <p>
                          {day.requestCount} request
                          {day.requestCount !== 1 ? "s" : ""}
                        </p>
                        {day.errorCount > 0 && (
                          <p className="text-danger">
                            {day.errorCount} error
                            {day.errorCount !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-text-tertiary px-0.5">
              {dailyData.length > 0 && (
                <>
                  <span>{formatDate(dailyData[0].date)}</span>
                  {dailyData.length > 15 && (
                    <span>
                      {formatDate(
                        dailyData[Math.floor(dailyData.length / 2)].date,
                      )}
                    </span>
                  )}
                  <span>
                    {formatDate(dailyData[dailyData.length - 1].date)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Model breakdown + User leaderboard ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model breakdown table */}
        <div className="bg-surface-secondary border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-text-tertiary" />
              <h3 className="text-sm font-semibold text-text">
                Model Breakdown
              </h3>
            </div>
            <button
              onClick={() => handleExport("by-model")}
              disabled={exporting}
              className="text-xs text-text-tertiary hover:text-text transition-colors disabled:opacity-50"
            >
              Export
            </button>
          </div>
          {modelLoading ? (
            <LoadingSkeleton height="h-52" />
          ) : modelData.length === 0 ? (
            <EmptyState message="No model usage data yet" />
          ) : (
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
          )}
        </div>

        {/* User leaderboard */}
        <div className="bg-surface-secondary border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold text-text">
                Top 10 Users by Token Usage
              </h3>
            </div>
            <button
              onClick={() => handleExport("by-user")}
              disabled={exporting}
              className="text-xs text-text-tertiary hover:text-text transition-colors disabled:opacity-50"
            >
              Export
            </button>
          </div>
          {userLoading ? (
            <LoadingSkeleton height="h-52" />
          ) : userData.length === 0 ? (
            <EmptyState message="No user usage data yet" />
          ) : (
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
          )}
        </div>
      </div>

      {/* ── Cost overview ──────────────────────────────────────────── */}
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

      {/* ── Export section ──────────────────────────────────────────── */}
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
              <Download className="h-3.5 w-3.5" />
              Daily
            </button>
            <button
              onClick={() => handleExport("by-model")}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-tertiary transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              By Model
            </button>
            <button
              onClick={() => handleExport("by-user")}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-tertiary transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              By User
            </button>
          </div>
        </div>
      </div>
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
