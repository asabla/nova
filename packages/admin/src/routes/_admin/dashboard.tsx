import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, MessageSquare, Zap } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/dashboard")({
  component: DashboardPage,
});

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.get<any>("/admin-api/stats"),
  });

  const { data: usage } = useQuery({
    queryKey: ["admin-usage"],
    queryFn: () => adminApi.get<any>("/admin-api/stats/usage"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Platform Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your NOVA platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Organisations" value={stats?.org_count ?? 0} icon={Building2} color="bg-blue-500/10 text-blue-400" />
        <StatCard label="Users" value={stats?.user_count ?? 0} icon={Users} color="bg-green-500/10 text-green-400" />
        <StatCard label="Conversations" value={stats?.conversation_count ?? 0} icon={MessageSquare} color="bg-purple-500/10 text-purple-400" />
        <StatCard label="Messages" value={stats?.message_count ?? 0} icon={Zap} color="bg-amber-500/10 text-amber-400" />
      </div>

      {stats?.active_users_7d != null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Active Users (7d)</p>
            <p className="text-2xl font-bold text-white">{Number(stats.active_users_7d).toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">New Orgs (30d)</p>
            <p className="text-2xl font-bold text-white">{Number(stats.new_orgs_30d).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Usage by org */}
      {usage?.data && usage.data.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Usage by Organisation (Last 30 Days)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 text-xs text-gray-500 font-medium">Organisation</th>
                  <th className="text-left py-2 text-xs text-gray-500 font-medium">Plan</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Members</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Messages</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {usage.data.map((org: any) => (
                  <tr key={org.orgId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2.5 text-white font-medium">{org.orgName}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-gray-400">
                        {org.billingPlan ?? "free"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-gray-400">{org.memberCount}</td>
                    <td className="py-2.5 text-right text-gray-400">{Number(org.messageCount).toLocaleString()}</td>
                    <td className="py-2.5 text-right text-gray-400">{Number(org.totalTokens).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
