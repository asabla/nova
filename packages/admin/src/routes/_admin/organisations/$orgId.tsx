import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, Settings, BarChart3, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/api";
import { useState } from "react";

export const Route = createFileRoute("/_admin/organisations/$orgId")({
  component: OrgDetailPage,
});

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"members" | "settings" | "usage">("members");

  const { data: org, isLoading } = useQuery({
    queryKey: ["admin-org", orgId],
    queryFn: () => adminApi.get<any>(`/admin-api/orgs/${orgId}`),
  });

  const { data: members } = useQuery({
    queryKey: ["admin-org-members", orgId],
    queryFn: () => adminApi.get<{ data: any[] }>(`/admin-api/orgs/${orgId}/members`),
    enabled: activeTab === "members",
  });

  const { data: usage } = useQuery({
    queryKey: ["admin-org-usage", orgId],
    queryFn: () => adminApi.get<any>(`/admin-api/orgs/${orgId}/usage`),
    enabled: activeTab === "usage",
  });

  const updateOrg = useMutation({
    mutationFn: (data: any) => adminApi.patch(`/admin-api/orgs/${orgId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-org", orgId] }),
  });

  const deleteOrg = useMutation({
    mutationFn: () => adminApi.delete(`/admin-api/orgs/${orgId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      window.history.back();
    },
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (!org) return <div className="text-gray-500">Organisation not found</div>;

  const tabs = [
    { id: "members" as const, icon: Users, label: "Members" },
    { id: "settings" as const, icon: Settings, label: "Settings" },
    { id: "usage" as const, icon: BarChart3, label: "Usage" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/organisations" className="text-gray-500 hover:text-gray-300">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{org.name}</h1>
          <p className="text-sm text-gray-500">{org.slug} · {org.billingPlan ?? "free"} plan</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">User</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Role</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(members?.data ?? []).map((m: any) => (
                <tr key={m.userId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{m.displayName}</p>
                    <p className="text-[10px] text-gray-500">{m.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-gray-400">{m.role}</span>
                    {m.isSuperAdmin && <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400 rounded">Super</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <OrgSettingsForm org={org} onSave={(data: any) => updateOrg.mutate(data)} />
          <div className="bg-gray-900 border border-red-900/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h3>
            <p className="text-xs text-gray-500 mb-3">Deleting an organisation is irreversible. All data will be soft-deleted.</p>
            <button
              onClick={() => { if (confirm(`Delete "${org.name}"? This cannot be undone.`)) deleteOrg.mutate(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Organisation
            </button>
          </div>
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === "usage" && usage && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Conversations (30d)</p>
            <p className="text-2xl font-bold text-white">{Number(usage.conversations).toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Messages (30d)</p>
            <p className="text-2xl font-bold text-white">{Number(usage.messages).toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tokens (30d)</p>
            <p className="text-2xl font-bold text-white">{Number(usage.tokens).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function OrgSettingsForm({ org, onSave }: { org: any; onSave: (data: any) => void }) {
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [plan, setPlan] = useState(org.billingPlan ?? "free");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-white">Organisation Settings</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-9 rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full h-9 rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full h-9 rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white">
            <option value="free">Free</option>
            <option value="team">Team</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>
      <button onClick={() => onSave({ name, slug, billingPlan: plan })} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">
        Save Changes
      </button>
    </div>
  );
}
