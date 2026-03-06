import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Users, Coins, TrendingUp } from "lucide-react";
import { api } from "../../lib/api";

export const Route = createFileRoute("/_auth/admin/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: stats } = useQuery({
    queryKey: ["analytics-stats"],
    queryFn: () => api.get<any>("/api/analytics/stats"),
    staleTime: 60_000,
  });

  const { data: models } = useQuery({
    queryKey: ["analytics-models"],
    queryFn: () => api.get<any>("/api/analytics/models"),
    staleTime: 60_000,
  });

  const { data: usage } = useQuery({
    queryKey: ["analytics-usage"],
    queryFn: () => api.get<any>("/api/analytics/usage?period=day&days=30"),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<MessageSquare className="h-5 w-5 text-primary" />}
          label="Total Conversations"
          value={stats?.conversations?.totalConversations ?? 0}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-success" />}
          label="Total Messages"
          value={stats?.messages?.totalMessages ?? 0}
        />
        <StatCard
          icon={<Coins className="h-5 w-5 text-warning" />}
          label="Total Tokens"
          value={formatNumber(stats?.messages?.totalTokens ?? 0)}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-primary" />}
          label="Active Users"
          value={stats?.users?.activeUsers ?? 0}
          subtitle={`of ${stats?.users?.totalUsers ?? 0} total`}
        />
      </div>

      {/* Model Usage */}
      <div className="bg-surface-secondary border border-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-text mb-4">Top Models</h3>
        <div className="space-y-3">
          {((models as any)?.data ?? []).map((m: any, idx: number) => (
            <div key={m.model} className="flex items-center gap-3">
              <span className="text-xs text-text-tertiary w-4">{idx + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text">{m.model}</span>
                  <span className="text-xs text-text-tertiary">{m.count} calls</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (m.count / ((models as any)?.data?.[0]?.count || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {!((models as any)?.data?.length) && (
            <p className="text-sm text-text-tertiary text-center py-4">No usage data yet</p>
          )}
        </div>
      </div>

      {/* Usage Timeline */}
      <div className="bg-surface-secondary border border-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-text mb-4">Daily Usage (Last 30 days)</h3>
        <div className="flex items-end gap-1 h-32">
          {((usage as any)?.data ?? []).map((day: any, idx: number) => {
            const maxCount = Math.max(...((usage as any)?.data ?? []).map((d: any) => d.messageCount), 1);
            const height = (day.messageCount / maxCount) * 100;
            return (
              <div
                key={idx}
                className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors cursor-pointer"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${day.date}: ${day.messageCount} messages`}
              />
            );
          })}
          {!((usage as any)?.data?.length) && (
            <p className="text-sm text-text-tertiary text-center w-full self-center">No usage data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtitle }: {
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
      {subtitle && <p className="text-[10px] text-text-tertiary mt-0.5">{subtitle}</p>}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
