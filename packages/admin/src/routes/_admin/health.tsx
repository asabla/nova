import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/health")({
  component: HealthPage,
});

function HealthPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => adminApi.get<any>("/admin-api/health-check"),
    refetchInterval: 30_000,
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case "unhealthy": return <XCircle className="h-5 w-5 text-red-400" />;
      default: return <AlertCircle className="h-5 w-5 text-yellow-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Health</h1>
          <p className="text-sm text-gray-500 mt-1">Service status and connectivity</p>
        </div>
        <button onClick={() => refetch()} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg">
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm animate-pulse">Checking services...</div>
      ) : data ? (
        <>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-900 border border-gray-800">
            {statusIcon(data.status)}
            <div>
              <p className="text-sm font-semibold text-white">
                Platform is {data.status === "healthy" ? "healthy" : "degraded"}
              </p>
              <p className="text-xs text-gray-500">
                Version {data.version} · Uptime {Math.floor(data.uptime / 3600)}h {Math.floor((data.uptime % 3600) / 60)}m
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(data.checks ?? {}).map(([service, check]: [string, any]) => (
              <div key={service} className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  {statusIcon(check.status)}
                  <div>
                    <p className="text-sm font-medium text-white capitalize">{service}</p>
                    {check.error && <p className="text-[10px] text-red-400 mt-0.5">{check.error}</p>}
                  </div>
                </div>
                {check.latencyMs != null && (
                  <span className="text-xs text-gray-500">{check.latencyMs}ms</span>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
