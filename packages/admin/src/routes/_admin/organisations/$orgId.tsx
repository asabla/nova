import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, Settings, BarChart3, Trash2, Shield, ExternalLink, Calendar, Building2 } from "lucide-react";
import { adminApi } from "@/lib/api";
import { useState } from "react";

export const Route = createFileRoute("/_admin/organisations/$orgId")({
  component: OrgDetailPage,
});

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "settings" | "usage">("overview");

  const { data: org, isLoading } = useQuery({
    queryKey: ["admin-org", orgId],
    queryFn: () => adminApi.get<any>(`/admin-api/orgs/${orgId}`),
  });

  const { data: members } = useQuery({
    queryKey: ["admin-org-members", orgId],
    queryFn: () => adminApi.get<{ data: any[] }>(`/admin-api/orgs/${orgId}/members`),
  });

  const { data: usage } = useQuery({
    queryKey: ["admin-org-usage", orgId],
    queryFn: () => adminApi.get<any>(`/admin-api/orgs/${orgId}/usage`),
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded skeleton" />
        <div className="h-32 rounded-xl skeleton" />
      </div>
    );
  }
  if (!org) return <div style={{ color: "var(--color-text-muted)" }}>Organisation not found</div>;

  const tabs = [
    { id: "overview" as const, icon: Building2, label: "Overview" },
    { id: "members" as const, icon: Users, label: `Members (${members?.data?.length ?? 0})` },
    { id: "usage" as const, icon: BarChart3, label: "Usage" },
    { id: "settings" as const, icon: Settings, label: "Settings" },
  ];

  const memberList = members?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/organisations" className="mt-1 p-1 rounded hover:bg-white/5 transition-colors" style={{ color: "var(--color-text-muted)" }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>{org.name}</h1>
            {org.isSystemOrg && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-blue-dim)", color: "var(--color-accent-blue)" }}>System Org</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="text-sm font-mono" style={{ color: "var(--color-text-muted)" }}>{org.slug}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}>
              {org.billingPlan ?? "free"}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <Calendar className="h-3 w-3" />
              Created {new Date(org.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: activeTab === id ? "var(--color-accent-blue)" : "transparent",
              color: activeTab === id ? "var(--color-accent-blue)" : "var(--color-text-muted)",
            }}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>Members</p>
            <p className="text-3xl font-bold mt-2" style={{ color: "var(--color-text-primary)" }}>{memberList.length}</p>
          </div>
          <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>Messages (30d)</p>
            <p className="text-3xl font-bold mt-2" style={{ color: "var(--color-text-primary)" }}>{Number(usage?.messages ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>Tokens (30d)</p>
            <p className="text-3xl font-bold mt-2" style={{ color: "var(--color-text-primary)" }}>{Number(usage?.tokens ?? 0).toLocaleString()}</p>
          </div>

          {/* Org Settings Summary */}
          {org.settings && org.settings.length > 0 && (
            <div className="col-span-full rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono mb-3" style={{ color: "var(--color-text-muted)" }}>Configuration</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {org.settings.slice(0, 8).map((s: any) => (
                  <div key={s.key} className="text-xs">
                    <span className="font-mono" style={{ color: "var(--color-text-muted)" }}>{s.key}</span>
                    <p className="font-medium mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          {memberList.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No members in this organisation</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                  {["User", "Role", "Joined"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {memberList.map((m: any) => (
                  <tr key={m.userId} className="row-hover transition-colors" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="px-5 py-3">
                      <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{m.displayName}</p>
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>{m.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}>
                        {m.role}
                      </span>
                      {m.isSuperAdmin && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-red-dim)", color: "var(--color-accent-red)" }}>
                          <Shield className="h-2.5 w-2.5" /> Super
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === "usage" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UsageStat label="Conversations" value={usage?.conversations} period="30d" color="var(--color-accent-blue)" />
          <UsageStat label="Messages" value={usage?.messages} period="30d" color="var(--color-accent-green)" />
          <UsageStat label="Tokens" value={usage?.tokens} period="30d" color="var(--color-accent-amber)" />
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <OrgSettingsForm org={org} onSave={(data: any) => updateOrg.mutate(data)} isPending={updateOrg.isPending} />

          <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "rgba(239, 68, 68, 0.2)" }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-accent-red)" }}>Danger Zone</h3>
            <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
              Deleting an organisation will soft-delete all associated data. This cannot be easily undone.
            </p>
            <button
              onClick={() => { if (confirm(`Delete "${org.name}"? This cannot be undone.`)) deleteOrg.mutate(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: "var(--color-accent-red)" }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Organisation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UsageStat({ label, value, period, color }: { label: string; value: any; period: string; color: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      <p className="text-3xl font-bold mt-2 tracking-tight" style={{ color: "var(--color-text-primary)" }}>
        {Number(value ?? 0).toLocaleString()}
      </p>
      <p className="text-[11px] mt-1" style={{ color }}>Last {period}</p>
    </div>
  );
}

function OrgSettingsForm({ org, onSave, isPending }: { org: any; onSave: (data: any) => void; isPending: boolean }) {
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [plan, setPlan] = useState(org.billingPlan ?? "free");
  const [domain, setDomain] = useState(org.domain ?? "");

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Organisation Settings</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5" style={{ color: "var(--color-text-muted)" }}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 rounded-lg border px-3 text-sm" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5" style={{ color: "var(--color-text-muted)" }}>Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full h-10 rounded-lg border px-3 text-sm font-mono" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5" style={{ color: "var(--color-text-muted)" }}>Billing Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full h-10 rounded-lg border px-3 text-sm" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}>
            <option value="free">Free</option>
            <option value="team">Team</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5" style={{ color: "var(--color-text-muted)" }}>Custom Domain</label>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="chat.example.com" className="w-full h-10 rounded-lg border px-3 text-sm font-mono" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }} />
        </div>
      </div>
      <button
        onClick={() => onSave({ name, slug, billingPlan: plan, domain: domain || null })}
        disabled={isPending}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
        style={{ background: "var(--color-accent-blue)" }}
      >
        {isPending ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
