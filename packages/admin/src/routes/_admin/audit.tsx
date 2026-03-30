import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { FileSearch, Filter, Download } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/audit")({
  component: AuditPage,
});

const RESOURCE_TYPES = [
  "user",
  "org",
  "agent",
  "conversation",
  "message",
  "file",
  "api_key",
  "webhook",
  "invitation",
  "membership",
  "subscription",
  "model",
  "tool",
  "skill",
  "knowledge_base",
  "workflow",
] as const;

const PAGE_SIZE = 100;

function AuditPage() {
  const [action, setAction] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-audit", action, orgFilter, since, until, resourceType, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (action) params.set("action", action);
      if (orgFilter) params.set("orgId", orgFilter);
      if (since) params.set("since", since);
      if (until) params.set("until", until);
      if (resourceType) params.set("resourceType", resourceType);
      return adminApi.get<{ data: any[]; total: number }>(`/admin-api/audit?${params}`);
    },
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;

  const actionColor = (action: string) => {
    if (action.includes("create") || action.includes("publish")) return "var(--color-accent-green)";
    if (action.includes("delete") || action.includes("deactivate")) return "var(--color-accent-red)";
    if (action.includes("update") || action.includes("grant")) return "var(--color-accent-amber)";
    return "var(--color-accent-blue)";
  };

  const resetOffset = useCallback(() => setOffset(0), []);

  const downloadCsv = useCallback(() => {
    if (!logs.length) return;
    const headers = ["Timestamp", "Action", "Resource Type", "Resource ID", "Organisation", "Actor", "IP Address"];
    const rows = logs.map((log: any) => [
      new Date(log.createdAt).toISOString(),
      log.action,
      log.resourceType ?? "",
      log.resourceId ?? "",
      log.orgId ?? "",
      log.actorId ?? "",
      log.ipAddress ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Audit Log</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Cross-organisation activity trail &middot; {total} total entries
          </p>
        </div>
        <button
          onClick={downloadCsv}
          disabled={logs.length === 0}
          className="flex items-center gap-2 h-9 px-4 rounded-lg border text-sm font-medium transition-colors"
          style={{
            background: "var(--color-surface-raised)",
            borderColor: "var(--color-border-default)",
            color: logs.length === 0 ? "var(--color-text-muted)" : "var(--color-text-primary)",
            cursor: logs.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 h-9 rounded-lg border" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)" }}>
          <Filter className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          <input
            value={action}
            onChange={(e) => { setAction(e.target.value); resetOffset(); }}
            placeholder="Filter by action..."
            className="bg-transparent border-none text-sm w-48 outline-none"
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>
        <input
          value={orgFilter}
          onChange={(e) => { setOrgFilter(e.target.value); resetOffset(); }}
          placeholder="Filter by org ID..."
          className="h-9 rounded-lg border px-3 text-sm font-mono w-64"
          style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
        />
        <select
          value={resourceType}
          onChange={(e) => { setResourceType(e.target.value); resetOffset(); }}
          className="h-9 rounded-lg border px-3 text-sm"
          style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)", color: resourceType ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
        >
          <option value="">All resource types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="date"
          value={since}
          onChange={(e) => { setSince(e.target.value); resetOffset(); }}
          className="h-9 rounded-lg border px-3 text-sm"
          style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)", color: since ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
          title="Since date"
        />
        <input
          type="date"
          value={until}
          onChange={(e) => { setUntil(e.target.value); resetOffset(); }}
          className="h-9 rounded-lg border px-3 text-sm"
          style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)", color: until ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
          title="Until date"
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
            {action || orgFilter || since || until || resourceType ? "No entries match your filters. Try adjusting the criteria." : "Audit entries will appear here as platform actions occur."}
          </p>
        </div>
      ) : (
        <>
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

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
              Showing {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, total)} of {total}
            </p>
            {hasMore && (
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={isFetching}
                className="h-9 px-4 rounded-lg border text-sm font-medium transition-colors"
                style={{
                  background: "var(--color-surface-raised)",
                  borderColor: "var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  cursor: isFetching ? "wait" : "pointer",
                }}
              >
                {isFetching ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
