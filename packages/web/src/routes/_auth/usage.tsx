import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Zap,
  DollarSign,
  MessageSquare,
  Bot,
  TrendingUp,
  AlertTriangle,
  HardDrive,
  BarChart3,
} from "lucide-react";
import { api } from "../../lib/api";

export const Route = createFileRoute("/_auth/usage")({
  component: UsagePage,
});

function UsagePage() {
  const { data: usageData, isLoading } = useQuery({
    queryKey: ["my-usage"],
    queryFn: () => api.get<any>("/api/analytics/me"),
    staleTime: 60_000,
  });

  const usage = usageData as any;

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const budget = usage?.budget;
  const isBudgetWarning =
    budget &&
    ((budget.tokenBudgetPercent !== null && budget.tokenBudgetPercent >= 80) ||
      (budget.costBudgetPercent !== null && budget.costBudgetPercent >= 80));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">My Usage</h1>
        <p className="text-sm text-text-secondary">
          Track your personal token usage and costs.
        </p>
      </div>

      {/* ── Budget Warning ──────────────────────────────────────── */}
      {isBudgetWarning && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning">
              Approaching usage limit
            </p>
            <p className="text-xs text-text-secondary mt-1">
              {budget.tokenBudgetPercent !== null &&
                budget.tokenBudgetPercent >= 80 && (
                  <span>
                    Token usage: {budget.tokenBudgetPercent}% of monthly limit
                    ({formatTokens(budget.currentMonthTokens)} /{" "}
                    {formatTokens(budget.monthlyTokenLimit)}).{" "}
                  </span>
                )}
              {budget.costBudgetPercent !== null &&
                budget.costBudgetPercent >= 80 && (
                  <span>
                    Cost: {budget.costBudgetPercent}% of monthly limit ($
                    {(budget.currentMonthCostCents / 100).toFixed(2)} / $
                    {(budget.monthlyCostLimitCents / 100).toFixed(2)}).
                  </span>
                )}
            </p>
          </div>
        </div>
      )}

      {/* ── Personal Usage Cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 text-text-tertiary mb-2">
            <Zap className="h-4 w-4" />
            <span className="text-xs">Total Tokens</span>
          </div>
          <p className="text-2xl font-bold text-text">
            {formatTokens(usage?.totalTokens ?? 0)}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 text-text-tertiary mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs">Estimated Cost</span>
          </div>
          <p className="text-2xl font-bold text-text">
            ${((usage?.totalCostCents ?? 0) / 100).toFixed(2)}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 text-text-tertiary mb-2">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">Requests</span>
          </div>
          <p className="text-2xl font-bold text-text">
            {usage?.requestCount ?? 0}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 text-text-tertiary mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs">Errors</span>
          </div>
          <p className="text-2xl font-bold text-text">
            {usage?.errorCount ?? 0}
          </p>
        </div>
      </div>

      {/* ── Storage Usage ───────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-surface-secondary border border-border">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm font-medium text-text">Storage Used</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">
            {formatBytes(usage?.storageBytes ?? 0)}
          </span>
          {budget?.storageQuotaMb && (
            <span className="text-sm text-text-secondary">
              of {budget.storageQuotaMb} MB
            </span>
          )}
        </div>
        <div className="w-full bg-border rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{
              width: `${Math.min(
                budget?.storageQuotaMb
                  ? ((usage?.storageBytes ?? 0) /
                      (budget.storageQuotaMb * 1_048_576)) *
                    100
                  : ((usage?.storageBytes ?? 0) / (1024 * 1_048_576)) * 100,
                100,
              )}%`,
            }}
          />
        </div>
      </div>

      {/* ── Budget Tracking ─────────────────────────────────────── */}
      {budget && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budget.monthlyTokenLimit !== null && (
            <div className="p-4 rounded-xl bg-surface-secondary border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text">
                  Monthly Token Budget
                </span>
                <span className="text-xs text-text-tertiary">
                  {budget.tokenBudgetPercent}%
                </span>
              </div>
              <div className="w-full bg-border rounded-full h-2 mb-2">
                <div
                  className={`rounded-full h-2 transition-all ${
                    (budget.tokenBudgetPercent ?? 0) >= 90
                      ? "bg-error"
                      : (budget.tokenBudgetPercent ?? 0) >= 80
                        ? "bg-warning"
                        : "bg-primary"
                  }`}
                  style={{
                    width: `${Math.min(budget.tokenBudgetPercent ?? 0, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-text-tertiary">
                {formatTokens(budget.currentMonthTokens)} of{" "}
                {formatTokens(budget.monthlyTokenLimit)} tokens used this month
              </p>
            </div>
          )}

          {budget.monthlyCostLimitCents !== null && (
            <div className="p-4 rounded-xl bg-surface-secondary border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text">
                  Monthly Cost Budget
                </span>
                <span className="text-xs text-text-tertiary">
                  {budget.costBudgetPercent}%
                </span>
              </div>
              <div className="w-full bg-border rounded-full h-2 mb-2">
                <div
                  className={`rounded-full h-2 transition-all ${
                    (budget.costBudgetPercent ?? 0) >= 90
                      ? "bg-error"
                      : (budget.costBudgetPercent ?? 0) >= 80
                        ? "bg-warning"
                        : "bg-primary"
                  }`}
                  style={{
                    width: `${Math.min(budget.costBudgetPercent ?? 0, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-text-tertiary">
                ${(budget.currentMonthCostCents / 100).toFixed(2)} of $
                {(budget.monthlyCostLimitCents / 100).toFixed(2)} used this
                month
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Daily Usage Mini-Chart ──────────────────────────────── */}
      {usage?.dailyUsage && (usage.dailyUsage as any[]).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text mb-3">Last 30 Days</h3>
          <div className="flex items-end gap-1 h-32 p-3 rounded-xl bg-surface-secondary border border-border">
            {(usage.dailyUsage as any[]).slice(-30).map((day: any, i: number) => {
              const maxTokens = Math.max(
                ...(usage.dailyUsage as any[]).map((d: any) => d.tokens),
                1,
              );
              const height = (day.tokens / maxTokens) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end group relative"
                >
                  <div
                    className="w-full bg-primary/60 hover:bg-primary rounded-t transition-colors min-h-[2px]"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                    <div className="bg-surface border border-border rounded px-2 py-1 text-xs text-text whitespace-nowrap shadow-lg">
                      <p>{day.date}</p>
                      <p>{formatTokens(day.tokens)} tokens</p>
                      <p>${(day.costCents / 100).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Usage by Model ──────────────────────────────────────── */}
      {usage?.byModel && (usage.byModel as any[]).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text mb-3">Usage by Model</h3>
          <div className="space-y-2">
            {(usage.byModel as any[]).map((item: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border"
              >
                <div>
                  <p className="text-sm font-medium text-text">
                    {item.modelName}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {item.requestCount} requests
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-text">
                    {formatTokens(item.tokens)}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    ${(item.costCents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rate Limit Status ───────────────────────────────────── */}
      {usage?.rateLimit && (
        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm font-medium text-text">
              Rate Limit Status
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-tertiary">Requests/min</p>
              <p className="text-text">
                {usage.rateLimit.requestsUsed} /{" "}
                {usage.rateLimit.requestsLimit}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Tokens/day</p>
              <p className="text-text">
                {formatTokens(usage.rateLimit.tokensUsed)} /{" "}
                {formatTokens(usage.rateLimit.tokensLimit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Resets in</p>
              <p className="text-text">{usage.rateLimit.resetsIn}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
