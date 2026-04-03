import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Activity, Database, HardDrive, Cloud, Cpu, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";

export const Route = createFileRoute("/_auth/admin/health")({
  component: AdminHealthPage,
});

function AdminHealthPage() {
  const { t } = useTranslation();
  const { data: healthData, refetch, isRefetching, isLoading: healthLoading } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => api.get<any>("/health/ready"),
    refetchInterval: 30_000,
  });

  const { data: systemData, isLoading: systemLoading } = useQuery({
    queryKey: ["system-info"],
    queryFn: () => api.get<any>("/health/system"),
  });

  const health = healthData as any;
  const system = systemData as any;

  const statusColor = (status: string) => {
    if (status === "ok" || status === "ready") return "text-success";
    if (status === "error" || status === "degraded") return "text-danger";
    return "text-warning";
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "ok" || status === "ready") return <CheckCircle className="h-5 w-5 text-success" aria-hidden="true" />;
    if (status === "error") return <XCircle className="h-5 w-5 text-danger" aria-hidden="true" />;
    return <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />;
  };

  const serviceIcon = (name: string) => {
    switch (name) {
      case "database": return <Database className="h-5 w-5" aria-hidden="true" />;
      case "redis": return <Cpu className="h-5 w-5" aria-hidden="true" />;
      case "s3": return <HardDrive className="h-5 w-5" aria-hidden="true" />;
      case "litellm": return <Cloud className="h-5 w-5" aria-hidden="true" />;
      case "temporal": return <Activity className="h-5 w-5" aria-hidden="true" />;
      default: return <Activity className="h-5 w-5" aria-hidden="true" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">{t("admin.healthTitle", { defaultValue: "System Health" })}</h2>
          <p className="text-sm text-text-secondary mt-1">{t("admin.healthDescription", { defaultValue: "Monitor all service connections and system status." })}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching} aria-label={t("admin.refreshHealth", { defaultValue: "Refresh health status" })}>
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} aria-hidden="true" />
          {t("admin.refresh", { defaultValue: "Refresh" })}
        </Button>
      </div>

      {/* Overall status */}
      {healthLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : health ? (
        <div className={`p-4 rounded-xl border ${
          health.status === "ready" ? "bg-success/5 border-success/20" : "bg-danger/5 border-danger/20"
        }`}>
          <div className="flex items-center gap-3">
            <StatusIcon status={health.status} />
            <div>
              <p className={`text-sm font-medium ${statusColor(health.status)}`}>
                {t("admin.systemStatus", { defaultValue: "System is {{status}}", status: health.status === "ready" ? t("admin.healthy", { defaultValue: "healthy" }) : health.status })}
              </p>
              <p className="text-xs text-text-tertiary">
                {t("admin.versionInfo", { defaultValue: "Version {{version}} | Last checked: {{time}}", version: health.version, time: new Date(health.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Service checks */}
      {healthLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : health?.checks ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(health.checks).map(([name, check]: [string, any]) => (
            <div key={name} className="p-4 rounded-xl bg-surface-secondary border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-text-secondary">
                  {serviceIcon(name)}
                  <span className="text-sm font-medium text-text capitalize">{name}</span>
                </div>
                <StatusIcon status={check.status} />
              </div>
              <div className="space-y-1 text-xs text-text-tertiary">
                <div className="flex justify-between">
                  <span>{t("admin.status", { defaultValue: "Status" })}</span>
                  <Badge variant={check.status === "ok" ? "success" : "danger"}>{check.status}</Badge>
                </div>
                {check.latencyMs !== undefined && (
                  <div className="flex justify-between">
                    <span>{t("admin.latency", { defaultValue: "Latency" })}</span>
                    <span className={check.latencyMs > 500 ? "text-warning" : "text-text-secondary"}>
                      {check.latencyMs}ms
                    </span>
                  </div>
                )}
                {check.error && (
                  <p className="text-danger mt-1 break-all">{check.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* System info */}
      {systemLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      ) : system ? (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text">{t("admin.systemInfo", { defaultValue: "System Information" })}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-surface-secondary border border-border">
              <p className="text-xs text-text-tertiary">{t("admin.version", { defaultValue: "Version" })}</p>
              <p className="text-sm font-medium text-text">{system.version}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-secondary border border-border">
              <p className="text-xs text-text-tertiary">{t("admin.runtime", { defaultValue: "Runtime" })}</p>
              <p className="text-sm font-medium text-text">{system.runtime} {system.runtimeVersion}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-secondary border border-border">
              <p className="text-xs text-text-tertiary">{t("admin.uptime", { defaultValue: "Uptime" })}</p>
              <p className="text-sm font-medium text-text">{formatUptime(system.uptime)}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-secondary border border-border">
              <p className="text-xs text-text-tertiary">{t("admin.memory", { defaultValue: "Memory" })}</p>
              <p className="text-sm font-medium text-text">
                {Math.round((system.memory?.heapUsed ?? 0) / 1024 / 1024)}MB / {Math.round((system.memory?.heapTotal ?? 0) / 1024 / 1024)}MB
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
