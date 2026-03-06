import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  X,
  RefreshCw,
  CheckCircle,
  Server,
  Database,
  Cpu,
  Radio,
} from "lucide-react";
import { clsx } from "clsx";

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  message?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "down";
  services: ServiceStatus[];
  version?: string;
}

/** Polling interval in milliseconds */
const POLL_INTERVAL = 30_000;
/** Faster polling when degraded */
const DEGRADED_POLL_INTERVAL = 10_000;

const serviceIcons: Record<string, typeof Server> = {
  api: Server,
  database: Database,
  temporal: Cpu,
  redis: Database,
  websocket: Radio,
};

function getServiceIcon(serviceName: string) {
  const key = serviceName.toLowerCase();
  for (const [match, icon] of Object.entries(serviceIcons)) {
    if (key.includes(match)) return icon;
  }
  return Server;
}

export function SystemStatusBanner() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/health", {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        setHealth({
          status: "down",
          services: [
            {
              name: "api",
              status: "down",
              message: `HTTP ${response.status}`,
            },
          ],
        });
        return;
      }

      const data: HealthResponse = await response.json();
      setHealth(data);

      // Auto-show banner again if status worsens after dismissal
      if (data.status !== "healthy") {
        setDismissed(false);
      }
    } catch {
      setHealth({
        status: "down",
        services: [
          {
            name: "api",
            status: "down",
            message: t("systemStatus.unreachable"),
          },
        ],
      });
      setDismissed(false);
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  }, [t]);

  // Initial fetch + polling
  useEffect(() => {
    fetchHealth();

    const interval = setInterval(
      fetchHealth,
      health?.status === "degraded" || health?.status === "down"
        ? DEGRADED_POLL_INTERVAL
        : POLL_INTERVAL,
    );

    return () => clearInterval(interval);
  }, [fetchHealth, health?.status]);

  // Nothing to show if healthy or dismissed
  if (!health || health.status === "healthy" || dismissed) return null;

  const degradedServices = health.services.filter(
    (s) => s.status !== "healthy",
  );
  const isDown = health.status === "down";

  return (
    <div
      className={clsx(
        "border-b px-4 py-2.5 animate-in slide-in-from-top duration-200",
        isDown
          ? "bg-danger/10 border-danger/20"
          : "bg-warning/10 border-warning/20",
      )}
      role="alert"
    >
      <div className="flex items-start gap-3 max-w-5xl mx-auto">
        {/* Icon */}
        <AlertTriangle
          className={clsx(
            "h-4 w-4 shrink-0 mt-0.5",
            isDown ? "text-danger" : "text-warning",
          )}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={clsx(
              "text-sm font-medium",
              isDown ? "text-danger" : "text-warning",
            )}
          >
            {isDown
              ? t("systemStatus.downTitle")
              : t("systemStatus.degradedTitle")}
          </p>

          {/* Affected services */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {degradedServices.map((service) => {
              const Icon = getServiceIcon(service.name);
              return (
                <span
                  key={service.name}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    service.status === "down"
                      ? "bg-danger/10 text-danger"
                      : "bg-warning/10 text-warning",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {service.name}
                  {service.message && (
                    <span className="opacity-70">- {service.message}</span>
                  )}
                </span>
              );
            })}
          </div>

          {/* Last checked */}
          {lastChecked && (
            <p className="text-[10px] text-text-tertiary mt-1.5 flex items-center gap-1">
              {loading ? (
                <>
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  {t("systemStatus.checking")}
                </>
              ) : (
                <>
                  <CheckCircle className="h-2.5 w-2.5" />
                  {t("systemStatus.lastChecked", {
                    time: lastChecked.toLocaleTimeString(),
                  })}
                </>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={fetchHealth}
            disabled={loading}
            className={clsx(
              "p-1.5 rounded-lg transition-colors",
              "text-text-secondary hover:text-text hover:bg-surface-secondary",
              loading && "opacity-50 pointer-events-none",
            )}
            aria-label={t("systemStatus.refresh")}
          >
            <RefreshCw
              className={clsx("h-3.5 w-3.5", loading && "animate-spin")}
            />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface-secondary transition-colors"
            aria-label={t("common.dismiss")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
