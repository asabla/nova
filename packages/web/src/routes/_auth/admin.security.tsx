import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield, Clock, Globe, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/admin/security")({
  component: SecurityPage,
});

function SecurityPage() {
  const { data: auditData } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => api.get<any>("/api/org/audit-logs?limit=50"),
    staleTime: 30_000,
  });

  const logs = (auditData as any)?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-text">TLS</span>
          </div>
          <p className="text-xs text-text-secondary">All data in transit encrypted with TLS 1.3+</p>
        </div>
        <div className="bg-surface-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-text">SSRF Protection</span>
          </div>
          <p className="text-xs text-text-secondary">Private IP ranges blocked on all URL operations</p>
        </div>
        <div className="bg-surface-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-text">Rate Limiting</span>
          </div>
          <p className="text-xs text-text-secondary">Per-user, per-IP, and per-org rate limits active</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text mb-3">Audit Log</h3>
        <div className="bg-surface-secondary border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-xs text-text-tertiary font-medium">Action</th>
                <th className="text-left px-4 py-2 text-xs text-text-tertiary font-medium">User</th>
                <th className="text-left px-4 py-2 text-xs text-text-tertiary font-medium">Resource</th>
                <th className="text-left px-4 py-2 text-xs text-text-tertiary font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface-tertiary/50">
                  <td className="px-4 py-2 text-text">{log.action}</td>
                  <td className="px-4 py-2 text-text-secondary">{log.userId?.slice(0, 8)}...</td>
                  <td className="px-4 py-2 text-text-secondary">{log.resourceType}</td>
                  <td className="px-4 py-2 text-text-tertiary text-xs">
                    {log.createdAt && formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-text-tertiary">No audit logs yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
