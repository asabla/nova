import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Shield, Filter, Download, Clock, User, AlertTriangle, Search } from "lucide-react";
import { Pagination } from "../../components/ui/Pagination";
import { api } from "../../lib/api";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { Select } from "../../components/ui/Select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { formatRelativeTime } from "../../lib/format";

interface AuditLog {
  id: string;
  createdAt: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

interface AuditResponse {
  data: AuditLog[];
  total: number;
}

export const Route = createFileRoute("/_auth/admin/audit")({
  component: AdminAuditPage,
});

const ACTION_CATEGORIES = [
  { value: "", label: "All actions" },
  { value: "conversation", label: "Conversations" },
  { value: "agent", label: "Agents" },
  { value: "knowledge", label: "Knowledge" },
  { value: "group", label: "Groups" },
  { value: "sso", label: "SSO" },
  { value: "gdpr", label: "GDPR" },
  { value: "api_key", label: "API Keys" },
  { value: "model", label: "Models" },
  { value: "user", label: "Users" },
];

function AdminAuditPage() {
  const { t } = useTranslation();
  const [actionFilter, setActionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: auditData, isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter, searchQuery, timeRange, page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (actionFilter) params.set("action", actionFilter);
      if (searchQuery) params.set("search", searchQuery);
      if (timeRange) {
        const now = new Date();
        const from = new Date();
        if (timeRange === "24h") from.setHours(now.getHours() - 24);
        else if (timeRange === "7d") from.setDate(now.getDate() - 7);
        else if (timeRange === "30d") from.setDate(now.getDate() - 30);
        params.set("from", from.toISOString());
      }
      return api.get<AuditResponse>(`/api/org/audit-logs?${params}`);
    },
  });

  const logs = auditData?.data ?? [];
  const total = auditData?.total ?? 0;
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
    const data = await api.get<AuditResponse>(`/api/org/audit-logs?${params}`);
    const csv = [
      "Timestamp,Actor,Action,Resource Type,Resource ID,Details",
      ...(data?.data ?? []).map((log: AuditLog) =>
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
          <h2 className="text-lg font-semibold text-text">{t("admin.auditTitle", { defaultValue: "Audit Log" })}</h2>
          <p className="text-sm text-text-secondary mt-1">{t("admin.auditDescription", { defaultValue: "Complete record of all user actions ({{total}} total)", total: total.toLocaleString() })}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleExport} aria-label={t("admin.exportCsv", { defaultValue: "Export CSV" })}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.exportCsv", { defaultValue: "Export CSV" })}
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-3">
        <Input
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          placeholder={t("admin.searchAudit", { defaultValue: "Search actor, action, or resource..." })}
          className="flex-1"
        />
        <Select
          value={actionFilter}
          onChange={(value) => { setActionFilter(value); setPage(1); }}
          options={ACTION_CATEGORIES}
          size="sm"
        />
        <Select
          value={timeRange}
          onChange={(value) => { setTimeRange(value); setPage(1); }}
          options={[
            { value: "", label: t("admin.allTime", { defaultValue: "All Time" }) },
            { value: "24h", label: t("admin.last24h", { defaultValue: "Last 24h" }) },
            { value: "7d", label: t("admin.last7d", { defaultValue: "Last 7 days" }) },
            { value: "30d", label: t("admin.last30d", { defaultValue: "Last 30 days" }) },
          ]}
          size="sm"
        />
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.time", { defaultValue: "Time" })}</TableHead>
              <TableHead>{t("admin.actor", { defaultValue: "Actor" })}</TableHead>
              <TableHead>{t("admin.action", { defaultValue: "Action" })}</TableHead>
              <TableHead>{t("admin.resource", { defaultValue: "Resource" })}</TableHead>
              <TableHead>{t("admin.details", { defaultValue: "Details" })}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="py-2">
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-text-tertiary whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatRelativeTime(log.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
                        <span className="font-mono text-[10px]">
                          {log.actorId?.slice(0, 8)}...
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary">
                      {log.resourceType}
                      {log.resourceId && (
                        <span className="font-mono text-[10px] text-text-tertiary ml-1">
                          {log.resourceId.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-text-tertiary max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-text-tertiary">
                      {t("admin.noAuditLogs", { defaultValue: "No audit logs found" })}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          showInfo
          totalItems={total}
          pageSize={pageSize}
        />
      )}
    </div>
  );
}
