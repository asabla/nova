import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Zap,
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  BarChart3,
} from "lucide-react";
import { api } from "../../lib/api";

export const Route = createFileRoute("/_auth/admin/analytics")({
  component: AnalyticsPage,
});

type DateRange = { from?: string; to?: string };

function AnalyticsPage() {
  const [dateRange] = useState<DateRange>({});
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const { data: summary } = useQuery({
    queryKey: ["analytics-summary", dateRange],
    queryFn: () => api.get<{ data: any }>(`/api/analytics/summary${qs}`),
    staleTime: 60_000,
  });

  const { data: daily } = useQuery({
    queryKey: ["analytics-daily"],
    queryFn: () => api.get<{ data: any[] }>("/api/analytics/daily?days=30"),
    staleTime: 60_000,
  });

  const { data: byModel } = useQuery({
    queryKey: ["analytics-by-model", dateRange],
    queryFn: () => api.get<{ data: any[] }>(`/api/analytics/by-model${qs}`),
    staleTime: 60_000,
  });

  const { data: byUser } = useQuery({
    queryKey: ["analytics-by-user", dateRange],
    queryFn: () => api.get<{ data: any[] }>(`/api/analytics/by-user${qs}`),
    staleTime: 60_000,
  });

  const { data: costs } = useQuery({
    queryKey: ["analytics-costs", dateRange],
    queryFn: () => api.get<{ data: any }>(`/api/analytics/costs${qs}`),
    staleTime: 60_000,
  });

  const { data: trends } = useQuery({
    queryKey: ["analytics-trends"],
    queryFn: () => api.get<{ data: any }>("/api/analytics/trends"),
    staleTime: 60_000,
  });

  const s = (summary as any)?.data;
  const dailyData = (daily as any)?.data ?? [];
  const modelData = (byModel as any)?.data ?? [];
  const userData = (byUser as any)?.data ?? [];
  const costData = (costs as any)?.data;
  const trendData = (trends as any)?.data;

  const handleExport = async (type: "daily" | "by-model" | "by-user") => {
    try {
      const res = await fetch("/api/analytics/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...dateRange }),
      });
      const csv = await res.text();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nova-analytics-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Analytics</h1>
          <p className="text-sm text-text-secondary">
            Organization usage and cost analytics.
          </p>
        </div>
        <button
          onClick={() => handleExport("daily")}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-surface-secondary border border-border text-text hover:bg-surface-tertiary transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* ── Overview Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          icon={<Zap className="h-4 w-4 text-primary" />}
          label="Total Tokens"
          value={formatNumber(s?.totalTokens ?? 0)}
          subtitle={`${formatNumber(s?.totalPromptTokens ?? 0)} prompt / ${formatNumber(s?.totalCompletionTokens ?? 0)} completion`}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-success" />}
          label="Total Cost"
          value={`$${((s?.totalCostCents ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-warning" />}
          label="Active Users"
          value={s?.activeUsers ?? 0}
          subtitle={`of ${s?.totalUsers ?? 0} total`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-primary" />}
          label="Avg Latency"
          value={`${s?.avgLatencyMs ?? 0}ms`}
          subtitle={`${formatNumber(s?.totalRequests ?? 0)} requests`}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-error" />}
          label="Error Rate"
          value={`${s?.errorRate ?? 0}%`}
          subtitle={`${s?.totalErrors ?? 0} errors`}
        />
      </div>

      {/* ── Trend Indicators ──────────────────────────────────────── */}
      {trendData && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <TrendCard
            label="Weekly Tokens"
            current={formatNumber(trendData.weekly.current.totalTokens)}
            change={trendData.weekly.tokenChange}
          />
          <TrendCard
            label="Weekly Cost"
            current={`$${(trendData.weekly.current.costCents / 100).toFixed(2)}`}
            change={trendData.weekly.costChange}
          />
          <TrendCard
            label="Weekly Requests"
            current={formatNumber(trendData.weekly.current.requestCount)}
            change={trendData.weekly.requestChange}
          />
        </div>
      )}

      {/* ── Daily Usage Chart ─────────────────────────────────────── */}
      <div className="bg-surface-secondary border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text">
            Daily Usage (Last 30 days)
          </h3>
          <button
            onClick={() => handleExport("daily")}
            className="text-xs text-text-tertiary hover:text-text transition-colors"
          >
            Export
          </button>
        </div>
        <div className="flex items-end gap-1 h-40">
          {dailyData.length > 0 ? (
            dailyData.map((day: any, idx: number) => {
              const maxTokens = Math.max(
                ...dailyData.map((d: any) => d.totalTokens),
                1,
              );
              const height = (day.totalTokens / maxTokens) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center justify-end group relative"
                >
                  <div
                    className="w-full bg-primary/40 hover:bg-primary/70 rounded-t transition-colors min-h-[2px]"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                    <div className="bg-surface border border-border rounded px-2 py-1 text-xs text-text whitespace-nowrap shadow-lg">
                      <p>{day.date}</p>
                      <p>{formatNumber(day.totalTokens)} tokens</p>
                      <p>${(day.costCents / 100).toFixed(2)}</p>
                      <p>{day.requestCount} requests</p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-text-tertiary text-center w-full self-center">
              No usage data yet
            </p>
          )}
        </div>
      </div>

      {/* ── Model Breakdown Table ─────────────────────────────────── */}
      <div className="bg-surface-secondary border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text">Usage by Model</h3>
          <button
            onClick={() => handleExport("by-model")}
            className="text-xs text-text-tertiary hover:text-text transition-colors"
          >
            Export
          </button>
        </div>
        {modelData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-tertiary border-b border-border">
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4 text-right">Tokens</th>
                  <th className="pb-2 pr-4 text-right">Prompt</th>
                  <th className="pb-2 pr-4 text-right">Completion</th>
                  <th className="pb-2 pr-4 text-right">Cost</th>
                  <th className="pb-2 pr-4 text-right">Requests</th>
                  <th className="pb-2 pr-4 text-right">Errors</th>
                  <th className="pb-2 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {modelData.map((m: any, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2 pr-4">
                      <p className="font-medium text-text">{m.modelName}</p>
                      <p className="text-xs text-text-tertiary">
                        {m.modelExternalId}
                      </p>
                    </td>
                    <td className="py-2 pr-4 text-right text-text">
                      {formatNumber(m.totalTokens)}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-secondary">
                      {formatNumber(m.promptTokens)}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-secondary">
                      {formatNumber(m.completionTokens)}
                    </td>
                    <td className="py-2 pr-4 text-right text-text">
                      ${(m.costCents / 100).toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-secondary">
                      {formatNumber(m.requestCount)}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-secondary">
                      {m.errorCount}
                    </td>
                    <td className="py-2 text-right text-text-secondary">
                      {m.avgLatencyMs}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-tertiary text-center py-4">
            No model usage data yet
          </p>
        )}
      </div>

      {/* ── User Leaderboard ──────────────────────────────────────── */}
      <div className="bg-surface-secondary border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text">
            Top Users by Token Usage
          </h3>
          <button
            onClick={() => handleExport("by-user")}
            className="text-xs text-text-tertiary hover:text-text transition-colors"
          >
            Export
          </button>
        </div>
        {userData.length > 0 ? (
          <div className="space-y-3">
            {userData.slice(0, 10).map((u: any, idx: number) => {
              const maxTokens = userData[0]?.totalTokens || 1;
              const pct = (u.totalTokens / maxTokens) * 100;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-text-tertiary w-5 text-right">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-text truncate block">
                          {u.displayName}
                        </span>
                        <span className="text-xs text-text-tertiary truncate block">
                          {u.email}
                        </span>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <span className="text-sm font-medium text-text">
                          {formatNumber(u.totalTokens)}
                        </span>
                        <span className="text-xs text-text-tertiary block">
                          ${(u.costCents / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary text-center py-4">
            No user usage data yet
          </p>
        )}
      </div>

      {/* ── Cost Trends ───────────────────────────────────────────── */}
      {costData && (
        <div className="bg-surface-secondary border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-text mb-4">Cost Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-text-tertiary">Total Cost</p>
              <p className="text-lg font-bold text-text">
                ${(costData.totalCostCents / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">This Month</p>
              <p className="text-lg font-bold text-text">
                ${(costData.currentMonthCostCents / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Projected Monthly</p>
              <p className="text-lg font-bold text-warning">
                ${(costData.projectedMonthlyCostCents / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Monthly Requests</p>
              <p className="text-lg font-bold text-text">
                {formatNumber(costData.currentMonthRequests)}
              </p>
            </div>
          </div>

          {/* Daily cost mini-chart */}
          {costData.dailyCosts?.length > 0 && (
            <div className="flex items-end gap-1 h-24">
              {costData.dailyCosts.slice(-30).map((day: any, idx: number) => {
                const maxCost = Math.max(
                  ...costData.dailyCosts.slice(-30).map((d: any) => d.costCents),
                  1,
                );
                const height = (day.costCents / maxCost) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 group relative flex flex-col items-center justify-end"
                  >
                    <div
                      className="w-full bg-success/40 hover:bg-success/70 rounded-t transition-colors min-h-[2px]"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                      <div className="bg-surface border border-border rounded px-2 py-1 text-xs text-text whitespace-nowrap shadow-lg">
                        {day.date}: ${(day.costCents / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-2xl font-bold text-text">{value}</p>
      <p className="text-xs text-text-tertiary">{label}</p>
      {subtitle && (
        <p className="text-[10px] text-text-tertiary mt-0.5">{subtitle}</p>
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
  const isPositive = change >= 0;
  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-4">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-lg font-bold text-text">{current}</p>
      <div
        className={`flex items-center gap-1 text-xs mt-1 ${isPositive ? "text-warning" : "text-success"}`}
      >
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span>
          {isPositive ? "+" : ""}
          {change}% vs last week
        </span>
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
