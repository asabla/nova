import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Zap, DollarSign, MessageSquare, Bot } from "lucide-react";
import { api } from "../../lib/api";

export const Route = createFileRoute("/_auth/usage")({
  component: UsagePage,
});

function UsagePage() {
  const { data: usageData } = useQuery({
    queryKey: ["my-usage"],
    queryFn: () => api.get<any>("/api/analytics/me"),
  });

  const { data: storageData } = useQuery({
    queryKey: ["my-storage"],
    queryFn: () => api.get<any>("/api/files/usage/me"),
  });

  const usage = usageData as any;
  const storage = storageData as any;

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">My Usage</h1>
        <p className="text-sm text-text-secondary">Track your personal token usage and costs.</p>
      </div>

      {/* Overview cards */}
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
            <span className="text-xs">Conversations</span>
          </div>
          <p className="text-2xl font-bold text-text">
            {usage?.conversationCount ?? 0}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 text-text-tertiary mb-2">
            <Bot className="h-4 w-4" />
            <span className="text-xs">Messages Sent</span>
          </div>
          <p className="text-2xl font-bold text-text">
            {usage?.messageCount ?? 0}
          </p>
        </div>
      </div>

      {/* Storage */}
      {storage && (
        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text">Storage Used</span>
            <span className="text-sm text-text-secondary">{storage.totalMb} MB</span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all"
              style={{ width: `${Math.min((storage.totalMb / 1024) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-text-tertiary mt-1">{storage.totalMb} MB of 1,024 MB used</p>
        </div>
      )}

      {/* Usage by model */}
      {usage?.byModel && (usage.byModel as any[]).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text mb-3">Usage by Model</h3>
          <div className="space-y-2">
            {(usage.byModel as any[]).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
                <div>
                  <p className="text-sm font-medium text-text">{item.model}</p>
                  <p className="text-xs text-text-tertiary">{item.requestCount} requests</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-text">{formatTokens(item.tokens)}</p>
                  <p className="text-xs text-text-tertiary">${(item.costCents / 100).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily usage chart (simplified bar visualization) */}
      {usage?.dailyUsage && (usage.dailyUsage as any[]).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text mb-3">Last 30 Days</h3>
          <div className="flex items-end gap-1 h-32 p-3 rounded-xl bg-surface-secondary border border-border">
            {(usage.dailyUsage as any[]).slice(-30).map((day: any, i: number) => {
              const maxTokens = Math.max(...(usage.dailyUsage as any[]).map((d: any) => d.tokens));
              const height = maxTokens > 0 ? (day.tokens / maxTokens) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div
                    className="w-full bg-primary/60 hover:bg-primary rounded-t transition-colors min-h-[2px]"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                    <div className="bg-surface border border-border rounded px-2 py-1 text-xs text-text whitespace-nowrap shadow-lg">
                      {day.date}: {formatTokens(day.tokens)} tokens
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rate limit status */}
      {usage?.rateLimit && (
        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm font-medium text-text">Rate Limit Status</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-tertiary">Requests/min</p>
              <p className="text-text">{usage.rateLimit.requestsUsed} / {usage.rateLimit.requestsLimit}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Tokens/day</p>
              <p className="text-text">{formatTokens(usage.rateLimit.tokensUsed)} / {formatTokens(usage.rateLimit.tokensLimit)}</p>
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
