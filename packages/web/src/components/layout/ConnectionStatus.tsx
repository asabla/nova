import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { useWSStore } from "../../stores/ws.store";

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
  const status = useWSStore((s) => s.status);
  const [showTooltip, setShowTooltip] = useState(false);

  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimating = status === "connecting" || status === "reconnecting";

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
          {status !== "connected" && (
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
            "w-56 rounded-xl border border-border bg-surface p-3 shadow-lg",
            "animate-in fade-in zoom-in-95 duration-150",
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Icon
              className={clsx(
                "h-4 w-4",
                status === "connected" && "text-success",
                (status === "connecting" || status === "reconnecting") && "text-warning",
                status === "disconnected" && "text-danger",
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
        </div>
      )}
    </div>
  );
}
