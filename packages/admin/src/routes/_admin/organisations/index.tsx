import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Users, MessageSquare, ExternalLink, Search, Shield } from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/Toast";

export const Route = createFileRoute("/_admin/organisations/")({
  component: OrgsPage,
});

function OrgsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("free");
  const [adminEmail, setAdminEmail] = useState("");
  const [isSystemOrg, setIsSystemOrg] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/orgs"),
  });

  const allOrgs = data?.data ?? [];
  const orgs = search
    ? allOrgs.filter((o: any) => o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.toLowerCase().includes(search.toLowerCase()))
    : allOrgs;

  const createOrg = useMutation({
    mutationFn: () => adminApi.post("/admin-api/orgs", {
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      billingPlan: plan,
      adminEmail: adminEmail || undefined,
      isSystemOrg,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      setShowCreate(false);
      setName(""); setSlug(""); setAdminEmail(""); setIsSystemOrg(false);
      toast("Organisation created", "success");
    },
    onError: (err: any) => toast(err.message ?? "Failed to create organisation", "error"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Organisations</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>{allOrgs.length} organisations on the platform</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: "var(--color-accent-blue)" }}
        >
          <Plus className="h-4 w-4" /> Create Organisation
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 h-10 rounded-lg border max-w-md" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)" }}>
        <Search className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organisations..."
          className="bg-transparent border-none text-sm flex-1 outline-none"
          style={{ color: "var(--color-text-primary)" }}
        />
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl border p-6 space-y-4" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>New Organisation</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5" style={{ color: "var(--color-text-muted)" }}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organisation name" className="w-full h-10 rounded-lg border px-3 text-sm" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5" style={{ color: "var(--color-text-muted)" }}>Slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "auto-generated"} className="w-full h-10 rounded-lg border px-3 text-sm font-mono" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }} />
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
              <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5" style={{ color: "var(--color-text-muted)" }}>Admin Email (optional)</label>
              <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" className="w-full h-10 rounded-lg border px-3 text-sm" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isSystemOrg} onChange={(e) => setIsSystemOrg(e.target.checked)} className="rounded" />
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>System organisation</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--color-accent-blue-dim)", color: "var(--color-accent-blue)" }}>Marketplace content visible to all orgs</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={() => createOrg.mutate()} disabled={!name || createOrg.isPending} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors" style={{ background: "var(--color-accent-blue)" }}>
              {createOrg.isPending ? "Creating..." : "Create"}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
        </div>
      ) : orgs.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <Building2 className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
            {search ? "No organisations match your search" : "No organisations yet"}
          </h3>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {search ? "Try a different search term." : "Create your first organisation to get started."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                {["Organisation", "Plan", "Members", "Conversations", "Created", ""].map((h) => (
                  <th key={h} className={`${h === "Members" || h === "Conversations" ? "text-right" : "text-left"} px-5 py-3 text-[10px] font-semibold uppercase tracking-wider font-mono`} style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((org: any) => (
                <tr key={org.id} className="row-hover transition-colors" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{org.name}</p>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>{org.slug}</p>
                      </div>
                      {org.isSystemOrg && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-blue-dim)", color: "var(--color-accent-blue)" }}>
                          <Shield className="h-2.5 w-2.5 inline mr-0.5" />System
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}>
                      {org.billingPlan ?? "free"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>{org.memberCount}</td>
                  <td className="px-5 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>{org.conversationCount}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{new Date(org.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to="/organisations/$orgId" params={{ orgId: org.id }} className="inline-flex items-center gap-1 text-xs font-medium transition-colors" style={{ color: "var(--color-accent-blue)" }}>
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
