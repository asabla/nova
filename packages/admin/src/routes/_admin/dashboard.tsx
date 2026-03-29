import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, Users, MessageSquare, Zap, TrendingUp, Activity, ArrowUpRight, Clock, RefreshCw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/dashboard")({
  component: DashboardPage,
});

function MetricCard({ label, value, icon: Icon, accentColor, dimColor, subtitle }: {
  label: string; value: number | string; icon: any; accentColor: string; dimColor: string; subtitle?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border p-5 transition-all duration-200 group"
      style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>{label}</p>
          <p className="text-3xl font-bold mt-2 tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && <p className="text-xs mt-1.5" style={{ color: "var(--color-text-secondary)" }}>{subtitle}</p>}
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: dimColor }}>
          <Icon className="h-5 w-5" style={{ color: accentColor }} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: accentColor }} />
    </div>
  );
}

const chartTooltipStyle = {
  backgroundColor: "var(--color-surface-overlay)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--color-text-primary)",
};

function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.get<any>("/admin-api/stats"),
    refetchInterval: 60_000,
  });

  const { data: usage } = useQuery({
    queryKey: ["admin-usage"],
    queryFn: () => adminApi.get<any>("/admin-api/stats/usage"),
    refetchInterval: 60_000,
  });

  const { data: daily } = useQuery({
    queryKey: ["admin-daily"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/stats/daily?days=30"),
    refetchInterval: 60_000,
  });

  const backfill = useMutation({
    mutationFn: () => adminApi.post("/admin-api/stats/backfill", { days: 90 }),
  });

  const chartData = (daily?.data ?? []).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    messages: Number(d.messages),
    tokens: Number(d.tokens),
    users: Number(d.userCount),
    orgs: Number(d.orgCount),
    conversations: Number(d.conversations),
  }));

  const hasChartData = chartData.length > 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Platform Overview</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>Real-time platform metrics and historical trends</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-surface-raised)" }}>
            <Activity className="h-3 w-3" style={{ color: "var(--color-accent-green)" }} />
            <span className="text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>Live</span>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[120px] rounded-xl skeleton" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Organisations" value={Number(stats?.org_count ?? 0)} icon={Building2} accentColor="var(--color-accent-blue)" dimColor="var(--color-accent-blue-dim)" />
          <MetricCard label="Users" value={Number(stats?.user_count ?? 0)} icon={Users} accentColor="var(--color-accent-green)" dimColor="var(--color-accent-green-dim)" subtitle={stats?.active_users_7d ? `${stats.active_users_7d} active this week` : undefined} />
          <MetricCard label="Conversations" value={Number(stats?.conversation_count ?? 0)} icon={MessageSquare} accentColor="var(--color-accent-purple)" dimColor="var(--color-accent-purple-dim)" />
          <MetricCard label="Messages" value={Number(stats?.message_count ?? 0)} icon={Zap} accentColor="var(--color-accent-amber)" dimColor="var(--color-accent-amber-dim)" />
        </div>
      )}

      {/* Charts */}
      {hasChartData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Messages Chart */}
          <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Messages</h2>
                <p className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>Last 30 days</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent-amber)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-accent-amber)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="messages" stroke="var(--color-accent-amber)" fill="url(#msgGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tokens Chart */}
          <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Token Usage</h2>
                <p className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>Last 30 days</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent-blue)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-accent-blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [value.toLocaleString(), "Tokens"]} />
                <Area type="monotone" dataKey="tokens" stroke="var(--color-accent-blue)" fill="url(#tokenGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border p-8 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <TrendingUp className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>No historical data yet</h3>
          <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Run the metrics backfill to populate charts from existing data, or wait for the hourly collection.
          </p>
          <button
            onClick={() => backfill.mutate()}
            disabled={backfill.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--color-accent-blue)" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${backfill.isPending ? "animate-spin" : ""}`} />
            {backfill.isPending ? "Backfilling..." : "Backfill Last 90 Days"}
          </button>
          {backfill.isSuccess && <p className="text-xs mt-2" style={{ color: "var(--color-accent-green)" }}>Backfill started. Refresh in a minute to see data.</p>}
        </div>
      )}

      {/* Secondary Metrics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4" style={{ color: "var(--color-accent-green)" }} />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>Growth</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>{Number(stats.new_orgs_30d ?? 0).toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>New organisations (30d)</p>
          </div>
          <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" style={{ color: "var(--color-accent-blue)" }} />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>Active</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>{Number(stats.active_users_7d ?? 0).toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>Active users (7d)</p>
          </div>
          <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4" style={{ color: "var(--color-accent-amber)" }} />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>Period</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>{chartData.length}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>Days of historical data</p>
          </div>
        </div>
      )}

      {/* Usage by Organisation Table */}
      {usage?.data && usage.data.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border-subtle)" }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Usage by Organisation</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Last 30 days</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                {["Organisation", "Plan", "Members", "Messages", "Tokens"].map((h) => (
                  <th key={h} className={`${h === "Members" || h === "Messages" || h === "Tokens" ? "text-right" : "text-left"} px-5 py-3 text-[10px] font-semibold uppercase tracking-wider font-mono`} style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usage.data.slice(0, 10).map((org: any) => (
                <tr key={org.orgId} className="row-hover transition-colors" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--color-text-primary)" }}>{org.orgName}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}>{org.billingPlan ?? "free"}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>{org.memberCount}</td>
                  <td className="px-5 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>{Number(org.messageCount).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>{Number(org.totalTokens).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!stats || (Number(stats.org_count) === 0 && Number(stats.user_count) === 0)) && (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <div className="inline-flex p-4 rounded-xl mb-4" style={{ background: "var(--color-accent-blue-dim)" }}>
            <Building2 className="h-8 w-8" style={{ color: "var(--color-accent-blue)" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>Welcome to NOVA Admin</h3>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--color-text-secondary)" }}>
            Your platform is ready. Create your first organisation to get started.
          </p>
          <a href="/organisations" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--color-accent-blue)" }}>
            Create Organisation <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
