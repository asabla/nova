import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { useConnectionStatus } from "../../hooks/useConnectionStatus";

const statusConfig = {
  connected: {
    color: "bg-success",
    ringColor: "ring-success/30",
    icon: Wifi,
    labelKey: "connection.connected",
    descriptionKey: "connection.connectedDesc",
  },
  connecting: {
    color: "bg-warning",
    ringColor: "ring-warning/30",
    icon: RefreshCw,
    labelKey: "connection.connecting",
    descriptionKey: "connection.connectingDesc",
  },
  reconnecting: {
    color: "bg-warning",
    ringColor: "ring-warning/30",
    icon: RefreshCw,
    labelKey: "connection.reconnecting",
    descriptionKey: "connection.reconnectingDesc",
  },
  disconnected: {
    color: "bg-danger",
    ringColor: "ring-danger/30",
    icon: WifiOff,
    labelKey: "connection.disconnected",
    descriptionKey: "connection.disconnectedDesc",
  },
} as const;

export function ConnectionStatus() {
  const { t } = useTranslation();
  const { isOnline, apiReachable, lastChecked, wsConnected } = useConnectionStatus();
  const [showTooltip, setShowTooltip] = useState(false);

  // Derive effective status from all signals:
  // - Browser offline → disconnected
  // - API reachable (primary transport is HTTP/SSE) → connected
  // - API unreachable but online → reconnecting
  const effectiveStatus: keyof typeof statusConfig = !isOnline
    ? "disconnected"
    : apiReachable
      ? "connected"
      : "reconnecting";

  const config = statusConfig[effectiveStatus];
  const Icon = config.icon;
  const isAnimating = effectiveStatus === "reconnecting";

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Dot indicator */}
      <button
        type="button"
        className={clsx(
          "flex items-center justify-center p-2 rounded-lg transition-colors",
          "hover:bg-surface-secondary text-text-secondary hover:text-text",
        )}
        aria-label={t(config.labelKey)}
      >
        <span className="relative flex h-3 w-3">
          {/* Ping animation for non-connected states */}
          {effectiveStatus !== "connected" && (
            <span
              className={clsx(
                "absolute inset-0 rounded-full opacity-75 animate-ping",
                config.color,
              )}
            />
          )}
          <span
            className={clsx(
              "relative inline-flex h-3 w-3 rounded-full ring-2",
              config.color,
              config.ringColor,
            )}
          />
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={clsx(
            "absolute right-0 top-full mt-1 z-50",
            "w-64 rounded-xl border border-border bg-surface p-3 shadow-lg",
            "animate-in fade-in zoom-in-95 duration-150",
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Icon
              className={clsx(
                "h-4 w-4",
                effectiveStatus === "connected" && "text-success",
                effectiveStatus === "reconnecting" && "text-warning",
                effectiveStatus === "disconnected" && "text-danger",
                isAnimating && "animate-spin",
              )}
            />
            <span className="text-sm font-medium text-text">
              {t(config.labelKey)}
            </span>
          </div>
          <p className="text-xs text-text-tertiary leading-relaxed">
            {t(config.descriptionKey)}
          </p>

          {/* Detailed connectivity info */}
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-tertiary">
                {t("connection.browser", { defaultValue: "Browser" })}
              </span>
              <span className={isOnline ? "text-success" : "text-danger"}>
                {isOnline
                  ? t("connection.online", { defaultValue: "Online" })
                  : t("connection.offline", { defaultValue: "Offline" })}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-tertiary">
                {t("connection.websocket", { defaultValue: "WebSocket" })}
              </span>
              <span className={wsConnected ? "text-success" : "text-warning"}>
                {wsConnected
                  ? t("connection.ok", { defaultValue: "OK" })
                  : t("connection.pending", { defaultValue: "Pending" })}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-tertiary">
                {t("connection.api", { defaultValue: "API" })}
              </span>
              <span className={apiReachable ? "text-success" : "text-danger"}>
                {apiReachable
                  ? t("connection.reachable", { defaultValue: "Reachable" })
                  : t("connection.unreachable", { defaultValue: "Unreachable" })}
              </span>
            </div>
            <p className="text-[10px] text-text-tertiary pt-1">
              {t("connection.lastChecked", {
                time: lastChecked.toLocaleTimeString(),
                defaultValue: "Checked at {{time}}",
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
