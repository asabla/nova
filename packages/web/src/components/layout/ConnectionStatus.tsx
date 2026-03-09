import { useState, useId } from "react";
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
    labelDefault: "Connected",
    descriptionKey: "connection.connectedDesc",
    descriptionDefault: "All systems operational",
  },
  connecting: {
    color: "bg-warning",
    ringColor: "ring-warning/30",
    icon: RefreshCw,
    labelKey: "connection.connecting",
    labelDefault: "Connecting",
    descriptionKey: "connection.connectingDesc",
    descriptionDefault: "Establishing connection...",
  },
  reconnecting: {
    color: "bg-warning",
    ringColor: "ring-warning/30",
    icon: RefreshCw,
    labelKey: "connection.reconnecting",
    labelDefault: "Reconnecting",
    descriptionKey: "connection.reconnectingDesc",
    descriptionDefault: "Attempting to restore connection...",
  },
  disconnected: {
    color: "bg-danger",
    ringColor: "ring-danger/30",
    icon: WifiOff,
    labelKey: "connection.disconnected",
    labelDefault: "Disconnected",
    descriptionKey: "connection.disconnectedDesc",
    descriptionDefault: "Unable to reach the server",
  },
} as const;

export function ConnectionStatus() {
  const { t } = useTranslation();
  const { isOnline, apiReachable, lastChecked, wsConnected } = useConnectionStatus();
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipId = useId();

  // Derive effective status from all signals:
  // - Browser offline → disconnected
  // - API reachable AND WebSocket connected → connected
  // - API reachable but WS not connected → connected (SSE is primary transport)
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
          "hover:bg-surface-secondary text-text-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-primary",
        )}
        aria-label={t(config.labelKey, config.labelDefault)}
        aria-describedby={showTooltip ? tooltipId : undefined}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
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
          id={tooltipId}
          role="tooltip"
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
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-text">
              {t(config.labelKey, config.labelDefault)}
            </span>
          </div>
          <p className="text-xs text-text-tertiary leading-relaxed">
            {t(config.descriptionKey, config.descriptionDefault)}
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
                time: lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
                defaultValue: "Checked at {{time}}",
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
