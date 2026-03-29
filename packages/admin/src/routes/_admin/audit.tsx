import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileSearch, Filter, Download } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const [action, setAction] = useState("");
  const [orgFilter, setOrgFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", action, orgFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (action) params.set("action", action);
      if (orgFilter) params.set("orgId", orgFilter);
      return adminApi.get<{ data: any[]; total: number }>(`/admin-api/audit?${params}`);
    },
  });

  const logs = data?.data ?? [];

  const actionColor = (action: string) => {
    if (action.includes("create") || action.includes("publish")) return "var(--color-accent-green)";
    if (action.includes("delete") || action.includes("deactivate")) return "var(--color-accent-red)";
    if (action.includes("update") || action.includes("grant")) return "var(--color-accent-amber)";
    return "var(--color-accent-blue)";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Audit Log</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Cross-organisation activity trail &middot; {data?.total ?? 0} total entries
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 h-9 rounded-lg border" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)" }}>
          <Filter className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filter by action..."
            className="bg-transparent border-none text-sm w-48 outline-none"
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>
        <input
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          placeholder="Filter by org ID..."
          className="h-9 rounded-lg border px-3 text-sm font-mono w-64"
          style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded-lg skeleton" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <FileSearch className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>No audit entries</h3>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {action || orgFilter ? "No entries match your filters. Try adjusting the criteria." : "Audit entries will appear here as platform actions occur."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                {["Timestamp", "Action", "Resource", "Organisation", "Actor"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="row-hover transition-colors" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                      style={{ background: "var(--color-surface-overlay)", color: actionColor(log.action) }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>
                    {log.resourceType && `${log.resourceType}:${log.resourceId?.slice(0, 8)}`}
                  </td>
                  <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                    {log.orgId?.slice(0, 8)}
                  </td>
                  <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                    {log.actorId?.slice(0, 8)}
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
