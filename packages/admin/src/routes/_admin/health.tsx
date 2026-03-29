import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, CheckCircle2, XCircle, AlertCircle, RefreshCw, Clock, Cpu, Database, HardDrive, Radio } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/health")({
  component: HealthPage,
});

const SERVICE_META: Record<string, { icon: any; label: string; description: string }> = {
  postgresql: { icon: Database, label: "PostgreSQL", description: "Primary database" },
  redis: { icon: Radio, label: "Redis", description: "Cache & pub/sub" },
  temporal: { icon: Cpu, label: "Temporal", description: "Workflow engine" },
  qdrant: { icon: HardDrive, label: "Qdrant", description: "Vector search" },
};

function HealthPage() {
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => adminApi.get<any>("/admin-api/health-check"),
    refetchInterval: 15_000,
  });

  const statusConfig = (status: string) => {
    switch (status) {
      case "healthy": return { icon: CheckCircle2, color: "var(--color-accent-green)", bg: "var(--color-accent-green-dim)", label: "Healthy" };
      case "unhealthy": return { icon: XCircle, color: "var(--color-accent-red)", bg: "var(--color-accent-red-dim)", label: "Unhealthy" };
      default: return { icon: AlertCircle, color: "var(--color-accent-amber)", bg: "var(--color-accent-amber-dim)", label: "Unknown" };
    }
  };

  const overallStatus = data ? statusConfig(data.status) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Platform Health</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Service status and connectivity monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-secondary)" }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-20 rounded-xl skeleton" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-xl skeleton" />)}
          </div>
        </div>
      ) : data ? (
        <>
          {/* Overall Status Banner */}
          <div
            className="rounded-xl border p-5 flex items-center gap-4"
            style={{ background: overallStatus?.bg, borderColor: "var(--color-border-subtle)" }}
          >
            {overallStatus && <overallStatus.icon className="h-7 w-7" style={{ color: overallStatus.color }} />}
            <div className="flex-1">
              <p className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Platform is {data.status}
              </p>
              <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--color-text-secondary)" }}>
                Version {data.version} &middot; Uptime {Math.floor(data.uptime / 86400)}d {Math.floor((data.uptime % 86400) / 3600)}h {Math.floor((data.uptime % 3600) / 60)}m
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "var(--color-surface-overlay)" }}>
              <span className="inline-block h-2 w-2 rounded-full animate-pulse" style={{ background: overallStatus?.color }} />
              <span className="text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>Auto-refresh 15s</span>
            </div>
          </div>

          {/* Service Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(data.checks ?? {}).map(([service, check]: [string, any]) => {
              const config = statusConfig(check.status);
              const meta = SERVICE_META[service] ?? { icon: Cpu, label: service, description: "" };
              const ServiceIcon = meta.icon;

              return (
                <div
                  key={service}
                  className="rounded-xl border p-5 transition-all duration-150"
                  style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg" style={{ background: "var(--color-surface-overlay)" }}>
                        <ServiceIcon className="h-5 w-5" style={{ color: config.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{meta.label}</p>
                        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{meta.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: config.bg }}>
                      <config.icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                      <span className="text-[11px] font-semibold" style={{ color: config.color }}>{config.label}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    {check.latencyMs != null && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" style={{ color: "var(--color-text-muted)" }} />
                        <span className="text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>{check.latencyMs}ms</span>
                      </div>
                    )}
                    {check.error && (
                      <span className="text-xs truncate" style={{ color: "var(--color-accent-red)" }}>{check.error}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <Heart className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Unable to reach the admin API. Check that the API server is running.</p>
        </div>
      )}
    </div>
  );
}
