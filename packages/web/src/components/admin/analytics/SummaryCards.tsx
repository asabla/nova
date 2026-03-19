import {
  Coins, DollarSign, Users, Timer, AlertTriangle,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import type { Summary, Trends } from "./types";
import { formatNumber, formatCost, formatLatency } from "./types";

export function SummaryCards({
  summary,
  loading,
}: {
  summary: Summary | undefined;
  loading: boolean;
}) {
  const s = summary;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard
        icon={<Coins className="h-5 w-5 text-primary" aria-hidden="true" />}
        label="Total Tokens"
        value={loading ? null : formatNumber(s?.totalTokens ?? 0)}
        subtitle={
          s
            ? `${formatNumber(s.totalPromptTokens)} in / ${formatNumber(s.totalCompletionTokens)} out`
            : undefined
        }
      />
      <StatCard
        icon={<DollarSign className="h-5 w-5 text-success" aria-hidden="true" />}
        label="Total Cost"
        value={loading ? null : formatCost(s?.totalCostCents ?? 0)}
        subtitle={s ? `${formatNumber(s.totalRequests)} requests` : undefined}
      />
      <StatCard
        icon={<Users className="h-5 w-5 text-primary" aria-hidden="true" />}
        label="Active Users"
        value={loading ? null : String(s?.activeUsers ?? 0)}
        subtitle={s ? `of ${s.totalUsers} total` : undefined}
      />
      <StatCard
        icon={<Timer className="h-5 w-5 text-warning" aria-hidden="true" />}
        label="Avg Latency"
        value={loading ? null : formatLatency(s?.avgLatencyMs ?? 0)}
      />
      <StatCard
        icon={<AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />}
        label="Error Rate"
        value={loading ? null : `${s?.errorRate ?? 0}%`}
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
  );
}

export function TrendCards({
  trends,
  loading,
}: {
  trends: Trends | undefined;
  loading: boolean;
}) {
  if (loading) return <LoadingSkeleton height="h-24" />;
  if (!trends) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <TrendCard label="Weekly Tokens" current={formatNumber(trends.weekly.current.totalTokens)} change={trends.weekly.tokenChange} />
      <TrendCard label="Weekly Cost" current={formatCost(trends.weekly.current.costCents)} change={trends.weekly.costChange} />
      <TrendCard label="Weekly Requests" current={formatNumber(trends.weekly.current.requestCount)} change={trends.weekly.requestChange} />
      <TrendCard label="Monthly Tokens" current={formatNumber(trends.monthly.current.totalTokens)} change={trends.monthly.tokenChange} />
      <TrendCard label="Monthly Cost" current={formatCost(trends.monthly.current.costCents)} change={trends.monthly.costChange} />
      <TrendCard label="Monthly Requests" current={formatNumber(trends.monthly.current.requestCount)} change={trends.monthly.requestChange} />
    </div>
  );
}

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

export function LoadingSkeleton({ height = "h-32" }: { height?: string }) {
  return (
    <div className={`${height} flex items-center justify-center`}>
      <div className="flex items-center gap-2 text-text-tertiary">
        <div className="h-4 w-4 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-32 flex items-center justify-center">
      <p className="text-sm text-text-tertiary">{message}</p>
    </div>
  );
}
