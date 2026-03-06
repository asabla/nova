import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield, Filter, Download, Clock, User, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/admin/audit")({
  component: AdminAuditPage,
});

const ACTION_CATEGORIES = [
  { value: "", label: "All actions" },
  { value: "conversation", label: "Conversations" },
  { value: "agent", label: "Agents" },
  { value: "knowledge", label: "Knowledge" },
  { value: "workspace", label: "Workspaces" },
  { value: "group", label: "Groups" },
  { value: "sso", label: "SSO" },
  { value: "gdpr", label: "GDPR" },
  { value: "api_key", label: "API Keys" },
  { value: "model", label: "Models" },
  { value: "user", label: "Users" },
];

function AdminAuditPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: auditData, isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter, page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (actionFilter) params.set("action", actionFilter);
      return api.get<any>(`/api/org/audit-logs?${params}`);
    },
  });

  const logs = (auditData as any)?.data ?? [];
  const total = (auditData as any)?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const getActionColor = (action: string) => {
    if (action.includes("delete") || action.includes("gdpr")) return "danger";
    if (action.includes("create") || action.includes("add")) return "success";
    if (action.includes("update") || action.includes("edit")) return "primary";
    return "default";
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    params.set("limit", "10000");
    if (actionFilter) params.set("action", actionFilter);
    const data = await api.get<any>(`/api/org/audit-logs?${params}`);
    const csv = [
      "Timestamp,Actor,Action,Resource Type,Resource ID,Details",
      ...(data?.data ?? []).map((log: any) =>
        `"${log.createdAt}","${log.actorId}","${log.action}","${log.resourceType}","${log.resourceId}","${JSON.stringify(log.details ?? {}).replace(/"/g, '""')}"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-text">Audit Log</h2>
          <p className="text-xs text-text-tertiary mt-1">Complete record of all user actions ({total.toLocaleString()} total)</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
          >
            {ACTION_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-secondary text-text-secondary text-xs">
              <th className="text-left px-4 py-2 font-medium">Time</th>
              <th className="text-left px-4 py-2 font-medium">Actor</th>
              <th className="text-left px-4 py-2 font-medium">Action</th>
              <th className="text-left px-4 py-2 font-medium">Resource</th>
              <th className="text-left px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => (
              <tr key={log.id} className="border-t border-border hover:bg-surface-secondary/50">
                <td className="px-4 py-2 text-xs text-text-tertiary whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </div>
                </td>
                <td className="px-4 py-2 text-xs">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-text-tertiary" />
                    <span className="text-text font-mono text-[10px]">
                      {log.actorId?.slice(0, 8)}...
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <Badge variant={getActionColor(log.action)}>
                    {log.action}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-xs text-text-secondary">
                  {log.resourceType}
                  {log.resourceId && (
                    <span className="font-mono text-[10px] text-text-tertiary ml-1">
                      {log.resourceId.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-text-tertiary max-w-xs truncate">
                  {log.details ? JSON.stringify(log.details) : "-"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-tertiary text-sm">
                  {isLoading ? "Loading..." : "No audit logs found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-xs text-text-tertiary">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
