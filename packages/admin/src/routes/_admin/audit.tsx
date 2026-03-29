import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const [action, setAction] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", action],
    queryFn: () => adminApi.get<{ data: any[]; total: number }>(`/admin-api/audit?action=${action}&limit=100`),
  });

  const logs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Cross-organisation audit trail</p>
      </div>

      <input
        value={action}
        onChange={(e) => setAction(e.target.value)}
        placeholder="Filter by action (e.g. org.create, agent.publish)..."
        className="h-9 w-full max-w-sm rounded-lg bg-gray-800 border border-gray-700 px-3 text-sm text-white placeholder:text-gray-500"
      />

      {isLoading ? (
        <div className="text-gray-500 text-sm animate-pulse">Loading...</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Action</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Resource</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Org</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-800 text-gray-300">{log.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{log.resourceType}:{log.resourceId?.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{log.orgId?.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{log.actorId?.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.total != null && (
            <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-800">{data.total} total entries</div>
          )}
        </div>
      )}
    </div>
  );
}
