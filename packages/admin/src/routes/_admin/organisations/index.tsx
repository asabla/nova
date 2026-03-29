import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Users, MessageSquare, ExternalLink } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/organisations/")({
  component: OrgsPage,
});

function OrgsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("free");
  const [adminEmail, setAdminEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/orgs"),
  });

  const orgs = data?.data ?? [];

  const createOrg = useMutation({
    mutationFn: () => adminApi.post("/admin-api/orgs", {
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      billingPlan: plan,
      adminEmail: adminEmail || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      setShowCreate(false);
      setName("");
      setSlug("");
      setAdminEmail("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Organisations</h1>
          <p className="text-sm text-gray-500 mt-1">{orgs.length} organisations on the platform</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Create Organisation
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">New Organisation</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organisation name" className="h-9 rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white" />
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (auto-generated)" className="h-9 rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white" />
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white">
              <option value="free">Free</option>
              <option value="team">Team</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Admin email (optional)" className="h-9 rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createOrg.mutate()} disabled={!name || createOrg.isPending} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-gray-400 hover:text-white text-sm">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Organisation</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Plan</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Members</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Conversations</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org: any) => (
                <tr key={org.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-white font-medium">{org.name}</p>
                        <p className="text-[10px] text-gray-500">{org.slug}</p>
                      </div>
                      {org.isSystemOrg && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400 rounded">System</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-gray-400">{org.billingPlan ?? "free"}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{org.memberCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{org.conversationCount}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/organisations/$orgId"
                      params={{ orgId: org.id }}
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      Manage <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
