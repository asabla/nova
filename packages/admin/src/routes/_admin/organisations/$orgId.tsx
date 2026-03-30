import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Users, Settings, BarChart3, Trash2, Shield, Calendar, Building2,
  UserPlus, UserMinus, Mail, Clock, FileSearch, Palette, Lock, ChevronDown,
  CheckCircle2, XCircle, ToggleLeft, ToggleRight, Image, Code2, Save, ExternalLink,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useState } from "react";

export const Route = createFileRoute("/_admin/organisations/$orgId")({
  component: () => {
    const { orgId } = Route.useParams();
    return <OrgDetailPage key={orgId} />;
  },
});

// Shared styles
const card = { background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" };
const inputStyle = { background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" };
const labelClass = "block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5";
const chartTooltip = { backgroundColor: "var(--color-surface-overlay)", border: "1px solid var(--color-border-default)", borderRadius: "8px", fontSize: "12px", color: "var(--color-text-primary)" };

type TabId = "overview" | "members" | "usage" | "security" | "branding" | "audit";

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const { data: org, isLoading } = useQuery({ queryKey: ["admin-org", orgId], queryFn: () => adminApi.get<any>(`/admin-api/orgs/${orgId}`) });
  const { data: members } = useQuery({ queryKey: ["admin-org-members", orgId], queryFn: () => adminApi.get<{ data: any[] }>(`/admin-api/orgs/${orgId}/members`) });
  const { data: usage } = useQuery({ queryKey: ["admin-org-usage", orgId], queryFn: () => adminApi.get<any>(`/admin-api/orgs/${orgId}/usage`) });

  const updateOrg = useMutation({
    mutationFn: (data: any) => adminApi.patch(`/admin-api/orgs/${orgId}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-org", orgId] }); toast("Organisation updated", "success"); },
    onError: () => toast("Failed to update organisation", "error"),
  });
  const deleteOrg = useMutation({
    mutationFn: () => adminApi.delete(`/admin-api/orgs/${orgId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-orgs"] }); toast("Organisation deleted"); window.history.back(); },
  });

  if (isLoading) return <div className="space-y-4"><div className="h-8 w-48 rounded skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  if (!org) return <div style={{ color: "var(--color-text-muted)" }}>Organisation not found</div>;

  const memberList = members?.data ?? [];
  const tabs: { id: TabId; icon: any; label: string }[] = [
    { id: "overview", icon: Building2, label: "Overview" },
    { id: "members", icon: Users, label: `Members (${memberList.length})` },
    { id: "usage", icon: BarChart3, label: "Usage" },
    { id: "security", icon: Lock, label: "Security" },
    { id: "branding", icon: Palette, label: "Branding" },
    { id: "audit", icon: FileSearch, label: "Audit" },
  ];

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
            {org.isSystemOrg && <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-blue-dim)", color: "var(--color-accent-blue)" }}>System</span>}
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}>{org.billingPlan ?? "free"}</span>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm font-mono" style={{ color: "var(--color-text-muted)" }}>{org.slug}</span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <Calendar className="h-3 w-3" /> {new Date(org.createdAt).toLocaleDateString()}
            </span>
            {org.setupCompletedAt && <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-accent-green)" }}><CheckCircle2 className="h-3 w-3" /> Setup complete</span>}
          </div>
        </div>
        <button
          onClick={async () => {
            try {
              // Ensure admin user has a profile in this org before opening
              await adminApi.post(`/admin-api/orgs/${orgId}/ensure-access`);
              const appUrl = import.meta.env.VITE_APP_URL ?? "http://localhost:5173";
              window.open(`${appUrl}?org=${orgId}`, "_blank");
            } catch {
              toast("Failed to open in app", "error");
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }}
        >
          Open in App <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b overflow-x-auto" style={{ borderColor: "var(--color-border-subtle)" }}>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap"
            style={{ borderColor: activeTab === id ? "var(--color-accent-blue)" : "transparent", color: activeTab === id ? "var(--color-accent-blue)" : "var(--color-text-muted)" }}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab org={org} memberCount={memberList.length} usage={usage} updateOrg={updateOrg} deleteOrg={deleteOrg} />}
      {activeTab === "members" && <MembersTab orgId={orgId} members={memberList} />}
      {activeTab === "usage" && <UsageTab orgId={orgId} />}
      {activeTab === "security" && <SecurityTab orgId={orgId} />}
      {activeTab === "branding" && <BrandingTab orgId={orgId} org={org} />}
      {activeTab === "audit" && <AuditTab orgId={orgId} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewTab({ org, memberCount, usage, updateOrg, deleteOrg }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Members" value={memberCount} color="var(--color-accent-blue)" />
        <StatCard label="Conversations" value={usage?.conversations} color="var(--color-accent-purple)" />
        <StatCard label="Messages (30d)" value={usage?.messages} color="var(--color-accent-green)" />
        <StatCard label="Tokens (30d)" value={usage?.tokens} color="var(--color-accent-amber)" />
      </div>

      {/* General Settings */}
      <GeneralSettingsForm org={org} onSave={(data: any) => updateOrg.mutate(data)} isPending={updateOrg.isPending} />

      {/* Danger Zone */}
      <div className="rounded-xl border p-5" style={{ ...card, borderColor: "rgba(239, 68, 68, 0.2)" }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-accent-red)" }}>Danger Zone</h3>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>Deleting is irreversible. All data will be soft-deleted.</p>
        <button onClick={() => { if (confirm(`Delete "${org.name}"?`)) deleteOrg.mutate(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--color-accent-red)" }}>
          <Trash2 className="h-3.5 w-3.5" /> Delete Organisation
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEMBERS TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function MembersTab({ orgId, members }: { orgId: string; members: any[] }) {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const { data: invitations } = useQuery({
    queryKey: ["admin-org-invitations", orgId],
    queryFn: () => adminApi.get<{ data: any[] }>(`/admin-api/orgs/${orgId}/invitations`),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => adminApi.patch(`/admin-api/orgs/${orgId}/members/${userId}/role`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-org-members", orgId] }); toast("Role updated"); },
    onError: () => toast("Failed to update role", "error"),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => adminApi.delete(`/admin-api/orgs/${orgId}/members/${userId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-org-members", orgId] }); toast("Member removed"); },
    onError: () => toast("Failed to remove member", "error"),
  });
  const invite = useMutation({
    mutationFn: () => adminApi.post(`/admin-api/orgs/${orgId}/invite`, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-org-invitations", orgId] }); setShowInvite(false); setInviteEmail(""); toast("Invitation sent"); },
    onError: () => toast("Failed to send invitation", "error"),
  });
  const revokeInvite = useMutation({
    mutationFn: (id: string) => adminApi.delete(`/admin-api/orgs/${orgId}/invitations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-org-invitations", orgId] }); toast("Invitation revoked"); },
  });

  const pendingInvites = invitations?.data ?? [];
  const roles = ["viewer", "member", "power-user", "org-admin"];

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{members.length} members</p>
        <button onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--color-accent-blue)" }}>
          <UserPlus className="h-3.5 w-3.5" /> Invite Member
        </button>
      </div>

      {/* Invite Form */}
      {showInvite && (
        <div className="rounded-xl border p-5 space-y-3" style={card}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Invite New Member</h3>
          <div className="flex gap-3">
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@example.com" type="email"
              className="flex-1 h-10 rounded-lg border px-3 text-sm" style={inputStyle} />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
              className="h-10 rounded-lg border px-3 text-sm w-36" style={inputStyle}>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={() => invite.mutate()} disabled={!inviteEmail || invite.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--color-accent-blue)" }}>
              {invite.isPending ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl border p-5" style={card}>
          <h3 className="text-xs font-semibold uppercase tracking-wider font-mono mb-3 flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
            <Mail className="h-3.5 w-3.5" style={{ color: "var(--color-accent-amber)" }} /> Pending Invitations ({pendingInvites.length})
          </h3>
          <div className="space-y-2">
            {pendingInvites.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "var(--color-surface-overlay)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono" style={{ color: "var(--color-text-primary)" }}>{inv.email}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}>{inv.role}</span>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                </div>
                <button onClick={() => revokeInvite.mutate(inv.id)} className="text-xs transition-colors" style={{ color: "var(--color-accent-red)" }}>Revoke</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-xl border overflow-hidden" style={card}>
        {members.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No members yet. Send an invitation to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                {["User", "Role", "Joined", ""].map((h) => (
                  <th key={h} className={`${h === "" ? "w-12" : ""} text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider font-mono`} style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.userId} className="row-hover transition-colors group" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <td className="px-5 py-3">
                    <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{m.displayName}</p>
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>{m.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <select value={m.role}
                      onChange={(e) => changeRole.mutate({ userId: m.userId, role: e.target.value })}
                      className="h-7 rounded border px-1.5 text-[11px] font-mono cursor-pointer"
                      style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-secondary)" }}>
                      {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {m.isSuperAdmin && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-red-dim)", color: "var(--color-accent-red)" }}>
                        <Shield className="h-2.5 w-2.5" /> Super
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-2 text-right">
                    <button onClick={() => { if (confirm(`Remove ${m.displayName}?`)) removeMember.mutate(m.userId); }}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--color-accent-red)" }}>
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   USAGE TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function UsageTab({ orgId }: { orgId: string }) {
  const [days, setDays] = useState(30);

  const { data: usage } = useQuery({
    queryKey: ["admin-org-usage", orgId, days],
    queryFn: () => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      return adminApi.get<any>(`/admin-api/orgs/${orgId}/usage?since=${since}`);
    },
  });
  const { data: daily } = useQuery({
    queryKey: ["admin-org-daily", orgId, days],
    queryFn: () => adminApi.get<{ data: any[] }>(`/admin-api/orgs/${orgId}/usage/daily?days=${days}`),
  });

  const chartData = (daily?.data ?? []).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    messages: Number(d.messages),
    tokens: Number(d.tokens),
  }));

  const ranges = [{ label: "7d", value: 7 }, { label: "30d", value: 30 }, { label: "90d", value: 90 }];

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center gap-2">
        {ranges.map((r) => (
          <button key={r.value} onClick={() => setDays(r.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: days === r.value ? "var(--color-accent-blue-dim)" : "var(--color-surface-raised)", color: days === r.value ? "var(--color-accent-blue)" : "var(--color-text-muted)", border: `1px solid ${days === r.value ? "var(--color-accent-blue)" : "var(--color-border-subtle)"}` }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Conversations" value={usage?.conversations} color="var(--color-accent-blue)" />
        <StatCard label="Messages" value={usage?.messages} color="var(--color-accent-green)" />
        <StatCard label="Tokens" value={usage?.tokens} color="var(--color-accent-amber)" />
      </div>

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Messages" dataKey="messages" data={chartData} color="var(--color-accent-green)" gradientId="orgMsgGrad" />
          <ChartCard title="Token Usage" dataKey="tokens" data={chartData} color="var(--color-accent-amber)" gradientId="orgTokGrad" />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECURITY TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function SecurityTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { data: security, isLoading } = useQuery({
    queryKey: ["admin-org-security", orgId],
    queryFn: () => adminApi.get<any>(`/admin-api/orgs/${orgId}/security`),
  });

  const [form, setForm] = useState<any>(null);
  const actualForm = form ?? security ?? {};

  const update = useMutation({
    mutationFn: (data: any) => adminApi.patch(`/admin-api/orgs/${orgId}/security`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-org-security", orgId] }); toast("Security settings saved"); },
    onError: () => toast("Failed to save security settings", "error"),
  });

  if (isLoading) return <div className="h-40 rounded-xl skeleton" />;

  const setField = (key: string, value: any) => setForm({ ...actualForm, [key]: value });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-6 space-y-5" style={card}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Authentication & Access</h3>

        {/* MFA Toggle */}
        <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Require MFA for all users</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Users must set up 2FA to access the organisation</p>
          </div>
          <button onClick={() => setField("mfaRequired", !actualForm.mfaRequired)}
            style={{ color: actualForm.mfaRequired ? "var(--color-accent-green)" : "var(--color-text-muted)" }}>
            {actualForm.mfaRequired ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
          </button>
        </div>

        {/* Password Policy */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>Password Policy</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Min Length</label>
              <input type="number" min={6} max={128} value={actualForm.passwordMinLength ?? 8} onChange={(e) => setField("passwordMinLength", Number(e.target.value))}
                className="w-full h-10 rounded-lg border px-3 text-sm font-mono" style={inputStyle} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Expiry (days, 0=never)</label>
              <input type="number" min={0} value={actualForm.passwordExpiryDays ?? 0} onChange={(e) => setField("passwordExpiryDays", Number(e.target.value))}
                className="w-full h-10 rounded-lg border px-3 text-sm font-mono" style={inputStyle} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {[{ key: "requireUppercase", label: "Uppercase" }, { key: "requireNumbers", label: "Numbers" }, { key: "requireSpecialChars", label: "Special chars" }].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={actualForm[key] ?? false} onChange={(e) => setField(key, e.target.checked)} className="rounded" />
                <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Session */}
        <div>
          <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Session Max Age (hours)</label>
          <input type="number" min={1} max={720} value={actualForm.sessionMaxAgeHours ?? 24} onChange={(e) => setField("sessionMaxAgeHours", Number(e.target.value))}
            className="w-full max-w-xs h-10 rounded-lg border px-3 text-sm font-mono" style={inputStyle} />
        </div>

        <button onClick={() => update.mutate(form ?? actualForm)} disabled={update.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--color-accent-blue)" }}>
          <Save className="h-3.5 w-3.5" /> {update.isPending ? "Saving..." : "Save Security Settings"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BRANDING TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function BrandingTab({ orgId, org }: { orgId: string; org: any }) {
  const qc = useQueryClient();
  const [logoUrl, setLogoUrl] = useState(org.logoUrl ?? "");
  const [faviconUrl, setFaviconUrl] = useState(org.faviconUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(org.primaryColor ?? "#3b82f6");
  const [customCss, setCustomCss] = useState(org.customCss ?? "");

  const save = useMutation({
    mutationFn: () => adminApi.patch(`/admin-api/orgs/${orgId}/branding`, { logoUrl: logoUrl || null, faviconUrl: faviconUrl || null, primaryColor: primaryColor || null, customCss: customCss || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-org", orgId] }); toast("Branding saved"); },
    onError: () => toast("Failed to save branding", "error"),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-6 space-y-5" style={card}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Brand Identity</h3>

        <div className="grid grid-cols-2 gap-6">
          {/* Logo */}
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Logo URL</label>
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="w-full h-10 rounded-lg border px-3 text-sm font-mono" style={inputStyle} />
            {logoUrl && (
              <div className="mt-3 p-4 rounded-lg border flex items-center justify-center" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)" }}>
                <img src={logoUrl} alt="Logo preview" className="max-h-12 max-w-[200px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>

          {/* Favicon */}
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Favicon URL</label>
            <input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://..." className="w-full h-10 rounded-lg border px-3 text-sm font-mono" style={inputStyle} />
            {faviconUrl && (
              <div className="mt-3 p-4 rounded-lg border flex items-center justify-center" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)" }}>
                <img src={faviconUrl} alt="Favicon preview" className="h-8 w-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>
        </div>

        {/* Primary Color */}
        <div>
          <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Primary Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-10 rounded-lg border-0 cursor-pointer" />
            <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-28 rounded-lg border px-3 text-sm font-mono" style={inputStyle} />
            <div className="h-10 flex-1 rounded-lg" style={{ background: primaryColor, opacity: 0.8 }} />
          </div>
        </div>

        {/* Custom CSS */}
        <div>
          <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>
            <Code2 className="h-3 w-3 inline mr-1" /> Custom CSS
          </label>
          <textarea value={customCss} onChange={(e) => setCustomCss(e.target.value)} rows={6} placeholder="/* Custom styles for this organisation */"
            className="w-full rounded-lg border px-3 py-2 text-sm font-mono resize-y" style={inputStyle} />
        </div>

        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--color-accent-blue)" }}>
          <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving..." : "Save Branding"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIT TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function AuditTab({ orgId }: { orgId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-org-audit", orgId],
    queryFn: () => adminApi.get<{ data: any[] }>(`/admin-api/orgs/${orgId}/audit`),
  });

  const logs = data?.data ?? [];

  const actionColor = (action: string) => {
    if (action.includes("create") || action.includes("publish") || action.includes("invite")) return "var(--color-accent-green)";
    if (action.includes("delete") || action.includes("remove") || action.includes("deactivate")) return "var(--color-accent-red)";
    if (action.includes("update") || action.includes("change")) return "var(--color-accent-amber)";
    return "var(--color-accent-blue)";
  };

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-lg skeleton" />)}</div>;

  return logs.length === 0 ? (
    <div className="rounded-xl border p-12 text-center" style={card}>
      <FileSearch className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No audit entries for this organisation yet.</p>
    </div>
  ) : (
    <div className="rounded-xl border overflow-hidden" style={card}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
            {["Time", "Action", "Resource", "Actor"].map((h) => (
              <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} className="row-hover transition-colors" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{new Date(log.createdAt).toLocaleString()}</td>
              <td className="px-5 py-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold" style={{ background: "var(--color-surface-overlay)", color: actionColor(log.action) }}>{log.action}</span>
              </td>
              <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>{log.resourceType}:{log.resourceId?.slice(0, 8)}</td>
              <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{log.actorId?.slice(0, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="rounded-xl border p-5 group relative overflow-hidden" style={card}>
      <p className="text-[11px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      <p className="text-3xl font-bold mt-2 tracking-tight" style={{ color: "var(--color-text-primary)" }}>{Number(value ?? 0).toLocaleString()}</p>
      <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: color }} />
    </div>
  );
}

function ChartCard({ title, dataKey, data, color, gradientId }: { title: string; dataKey: string; data: any[]; color: string; gradientId: string }) {
  return (
    <div className="rounded-xl border p-5" style={card}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
      <p className="text-[11px] font-mono mb-4" style={{ color: "var(--color-text-muted)" }}>Daily volume</p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} width={45} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip contentStyle={chartTooltip} formatter={(v: number) => [v.toLocaleString(), title]} />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function GeneralSettingsForm({ org, onSave, isPending }: { org: any; onSave: (data: any) => void; isPending: boolean }) {
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [plan, setPlan] = useState(org.billingPlan ?? "free");
  const [domain, setDomain] = useState(org.domain ?? "");

  return (
    <div className="rounded-xl border p-6 space-y-4" style={card}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>General</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 rounded-lg border px-3 text-sm" style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full h-10 rounded-lg border px-3 text-sm font-mono" style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Billing Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full h-10 rounded-lg border px-3 text-sm" style={inputStyle}>
            <option value="free">Free</option>
            <option value="team">Team — $29/user/mo</option>
            <option value="enterprise">Enterprise — Custom</option>
          </select>
        </div>
        <div>
          <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Custom Domain</label>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="chat.example.com" className="w-full h-10 rounded-lg border px-3 text-sm font-mono" style={inputStyle} />
        </div>
      </div>
      <button onClick={() => onSave({ name, slug, billingPlan: plan, domain: domain || null })} disabled={isPending}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--color-accent-blue)" }}>
        <Save className="h-3.5 w-3.5" /> {isPending ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
