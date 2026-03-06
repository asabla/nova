import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Zap,
  DollarSign,
  MessageSquare,
  HardDrive,
  AlertTriangle,
  BarChart3,
  Cpu,
  TrendingUp,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";

export const Route = createFileRoute("/_auth/usage")({
  component: UsagePage,
});

// ── Types ────────────────────────────────────────────────────────────

interface PersonalUsage {
  totalTokens: number;
  totalCostCents: number;
  requestCount: number;
  errorCount: number;
  storageBytes: number;
  byModel: ModelUsage[];
  dailyUsage: DailyUsage[];
  budget: BudgetInfo | null;
  rateLimit?: RateLimitInfo;
}

interface ModelUsage {
  modelId: string;
  modelName: string;
  tokens: number;
  costCents: number;
  requestCount: number;
}

interface DailyUsage {
  date: string;
  tokens: number;
  costCents: number;
}

interface BudgetInfo {
  monthlyTokenLimit: number | null;
  monthlyCostLimitCents: number | null;
  storageQuotaMb: number | null;
  currentMonthTokens: number;
  currentMonthCostCents: number;
  tokenBudgetPercent: number | null;
  costBudgetPercent: number | null;
}

interface RateLimitInfo {
  requestsUsed: number;
  requestsLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  resetsIn: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes >= 1_073_741_824)
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main component ───────────────────────────────────────────────────

function UsagePage() {
  const { data: usageRaw, isLoading } = useQuery({
    queryKey: ["my-usage"],
    queryFn: () => api.get<PersonalUsage>("/api/analytics/me"),
    staleTime: 30_000,
  });

  const usage = usageRaw as PersonalUsage | undefined;
  const byModel = (usage?.byModel ?? []) as ModelUsage[];
  const dailyUsage = (usage?.dailyUsage ?? []).slice(-14) as DailyUsage[];
  const budget = usage?.budget ?? null;

  // Budget warning thresholds
  const tokenBudgetPct = budget?.tokenBudgetPercent ?? null;
  const costBudgetPct = budget?.costBudgetPercent ?? null;
  const tokenWarning = tokenBudgetPct !== null && tokenBudgetPct >= 80;
  const costWarning = costBudgetPct !== null && costBudgetPct >= 80;
  const tokenCritical = tokenBudgetPct !== null && tokenBudgetPct >= 95;
  const costCritical = costBudgetPct !== null && costBudgetPct >= 95;
  const showWarning = tokenWarning || costWarning;

  // Storage calculations
  const storageMb = (usage?.storageBytes ?? 0) / 1_048_576;
  const storageQuotaMb = budget?.storageQuotaMb ?? 1024;
  const storagePercent =
    storageQuotaMb > 0 ? Math.min((storageMb / storageQuotaMb) * 100, 100) : 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-lg font-semibold text-text">My Usage</h1>
        <p className="text-sm text-text-secondary">
          Track your personal token usage, costs, and storage.
        </p>
      </div>

      {/* ── Budget warning banner ──────────────────────────────────── */}
      {showWarning && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            tokenCritical || costCritical
              ? "bg-danger/5 border-danger/30"
              : "bg-warning/5 border-warning/30"
          }`}
        >
          <AlertTriangle
            className={`h-5 w-5 shrink-0 mt-0.5 ${
              tokenCritical || costCritical ? "text-danger" : "text-warning"
            }`}
          />
          <div>
            <p
              className={`text-sm font-semibold ${
                tokenCritical || costCritical ? "text-danger" : "text-warning"
              }`}
            >
              {tokenCritical || costCritical
                ? "Budget limit nearly reached"
                : "Approaching budget limit"}
            </p>
            <div className="text-xs text-text-secondary mt-1 space-y-0.5">
              {tokenWarning && budget?.monthlyTokenLimit != null && (
                <p>
                  Token usage: {formatTokens(budget.currentMonthTokens)} of{" "}
                  {formatTokens(budget.monthlyTokenLimit)} (
                  {budget.tokenBudgetPercent}%)
                </p>
              )}
              {costWarning && budget?.monthlyCostLimitCents != null && (
                <p>
                  Cost usage: {formatCost(budget.currentMonthCostCents)} of{" "}
                  {formatCost(budget.monthlyCostLimitCents)} (
                  {budget.costBudgetPercent}%)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Personal stat cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PersonalStatCard
          icon={<Zap className="h-4 w-4 text-primary" />}
          label="My Tokens"
          value={isLoading ? null : formatTokens(usage?.totalTokens ?? 0)}
        />
        <PersonalStatCard
          icon={<DollarSign className="h-4 w-4 text-success" />}
          label="My Cost"
          value={isLoading ? null : formatCost(usage?.totalCostCents ?? 0)}
        />
        <PersonalStatCard
          icon={<MessageSquare className="h-4 w-4 text-primary" />}
          label="My Requests"
          value={isLoading ? null : String(usage?.requestCount ?? 0)}
        />
        <PersonalStatCard
          icon={<HardDrive className="h-4 w-4 text-warning" />}
          label="My Storage"
          value={isLoading ? null : formatBytes(usage?.storageBytes ?? 0)}
        />
      </div>

      {/* ── Monthly budget progress ────────────────────────────────── */}
      {budget &&
        (budget.monthlyTokenLimit != null ||
          budget.monthlyCostLimitCents != null) && (
          <div className="bg-surface-secondary border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text">Monthly Budget</h3>

            {budget.monthlyTokenLimit != null && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-text-secondary">
                    Token Budget
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text tabular-nums">
                      {formatTokens(budget.currentMonthTokens)} /{" "}
                      {formatTokens(budget.monthlyTokenLimit)}
                    </span>
                    <Badge
                      variant={
                        tokenCritical
                          ? "danger"
                          : tokenWarning
                            ? "warning"
                            : "success"
                      }
                    >
                      {budget.tokenBudgetPercent ?? 0}%
                    </Badge>
                  </div>
                </div>
                <BudgetBar percent={budget.tokenBudgetPercent ?? 0} />
              </div>
            )}

            {budget.monthlyCostLimitCents != null && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-text-secondary">
                    Cost Budget
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text tabular-nums">
                      {formatCost(budget.currentMonthCostCents)} /{" "}
                      {formatCost(budget.monthlyCostLimitCents)}
                    </span>
                    <Badge
                      variant={
                        costCritical
                          ? "danger"
                          : costWarning
                            ? "warning"
                            : "success"
                      }
                    >
                      {budget.costBudgetPercent ?? 0}%
                    </Badge>
                  </div>
                </div>
                <BudgetBar percent={budget.costBudgetPercent ?? 0} />
              </div>
            )}
          </div>
        )}

      {/* ── Daily mini-chart (last 14 days) ────────────────────────── */}
      <div className="bg-surface-secondary border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text">Last 14 Days</h3>
        </div>
        {isLoading ? (
          <LoadingSkeleton />
        ) : dailyUsage.length === 0 ? (
          <EmptyState message="No recent usage data" />
        ) : (
          <div className="space-y-2">
            <div className="flex items-end gap-1.5 h-36">
              {dailyUsage.map((day, idx) => {
                const maxTokens = Math.max(
                  ...dailyUsage.map((d) => d.tokens),
                  1,
                );
                const height = (day.tokens / maxTokens) * 100;
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
                        <p className="font-semibold mb-0.5">
                          {formatDate(day.date)}
                        </p>
                        <p>{formatTokens(day.tokens)} tokens</p>
                        <p>{formatCost(day.costCents)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-text-tertiary px-0.5">
              {dailyUsage.length > 0 && (
                <>
                  <span>{formatDate(dailyUsage[0].date)}</span>
                  <span>
                    {formatDate(dailyUsage[dailyUsage.length - 1].date)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Per-model breakdown with progress bars ─────────────────── */}
      <div className="bg-surface-secondary border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-4 w-4 text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text">Usage by Model</h3>
        </div>
        {isLoading ? (
          <LoadingSkeleton />
        ) : byModel.length === 0 ? (
          <EmptyState message="No model usage data yet" />
        ) : (
          <div className="space-y-4">
            {byModel.map((m) => {
              const maxTokens = byModel[0]?.tokens || 1;
              const pct = (m.tokens / maxTokens) * 100;
              return (
                <div key={m.modelId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-text truncate">
                        {m.modelName}
                      </span>
                      <Badge variant="default">
                        {m.requestCount} req{m.requestCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-xs text-text-secondary tabular-nums">
                        {formatTokens(m.tokens)}
                      </span>
                      <span className="text-xs text-text-tertiary tabular-nums">
                        {formatCost(m.costCents)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Storage usage ──────────────────────────────────────────── */}
      <div className="bg-surface-secondary border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text">Storage</h3>
          </div>
          <span className="text-xs text-text-secondary tabular-nums">
            {storageMb.toFixed(1)} MB of {storageQuotaMb.toLocaleString()} MB
          </span>
        </div>
        <div className="h-3 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              storagePercent >= 90
                ? "bg-danger"
                : storagePercent >= 70
                  ? "bg-warning"
                  : "bg-primary"
            }`}
            style={{ width: `${Math.max(storagePercent, 0.5)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-text-tertiary">
            {storagePercent.toFixed(1)}% used
          </span>
          {storagePercent >= 90 && <Badge variant="danger">Nearly full</Badge>}
          {storagePercent >= 70 && storagePercent < 90 && (
            <Badge variant="warning">Getting full</Badge>
          )}
        </div>
      </div>

      {/* ── Rate limit status ──────────────────────────────────────── */}
      {usage?.rateLimit && (
        <div className="bg-surface-secondary border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text">
              Rate Limit Status
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Requests/min</p>
              <p className="text-text tabular-nums">
                {usage.rateLimit.requestsUsed} /{" "}
                {usage.rateLimit.requestsLimit}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Tokens/day</p>
              <p className="text-text tabular-nums">
                {formatTokens(usage.rateLimit.tokensUsed)} /{" "}
                {formatTokens(usage.rateLimit.tokensLimit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Resets in</p>
              <p className="text-text">{usage.rateLimit.resetsIn}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function PersonalStatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="p-4 rounded-xl bg-surface-secondary border border-border transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2 text-text-tertiary mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      {value === null ? (
        <div className="h-8 flex items-center">
          <div className="h-4 w-4 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
        </div>
      ) : (
        <p className="text-2xl font-bold text-text tabular-nums">{value}</p>
      )}
    </div>
  );
}

function BudgetBar({ percent }: { percent: number }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const color =
    clamped >= 95
      ? "bg-danger"
      : clamped >= 80
        ? "bg-warning"
        : "bg-success";

  return (
    <div className="h-2.5 bg-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(clamped, 0.5)}%` }}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-36 flex items-center justify-center">
      <div className="flex items-center gap-2 text-text-tertiary">
        <div className="h-4 w-4 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-36 flex items-center justify-center">
      <p className="text-sm text-text-tertiary">{message}</p>
    </div>
  );
}
