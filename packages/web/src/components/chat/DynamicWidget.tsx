import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import { WIDGET_REGISTRY } from "./widgets/registry";

/**
 * Dynamic Widget component (Story #131).
 * Renders embeddable widgets within conversations for live data display.
 */

export interface WidgetConfig {
  type: "weather" | "iframe" | "api" | "countdown" | "poll" | "chart" | "progress" | "timer" | "map" | "math";
  title?: string;
  /** For iframe widgets */
  src?: string;
  /** For API widgets - endpoint to fetch data from */
  endpoint?: string;
  /** Refresh interval in seconds (0 = no auto-refresh) */
  refreshInterval?: number;
  /** Widget height in pixels */
  height?: number;
  /** Custom parameters for the widget */
  params?: Record<string, string>;
}

interface DynamicWidgetProps {
  config: WidgetConfig;
  className?: string;
}

export function DynamicWidget({ config, className }: DynamicWidgetProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh
  useEffect(() => {
    if (!config.refreshInterval || config.refreshInterval <= 0) return;
    const interval = setInterval(
      () => setRefreshKey((k) => k + 1),
      config.refreshInterval * 1000,
    );
    return () => clearInterval(interval);
  }, [config.refreshInterval]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Resolve widget component from registry
  const WidgetComponent = WIDGET_REGISTRY[config.type];

  return (
    <div
      className={clsx(
        "rounded-xl border border-border overflow-hidden bg-surface-secondary my-2",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-tertiary/50">
        <span className="text-xs font-medium text-text truncate">
          {config.title ?? config.type}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {config.type !== "iframe" && (
            <button
              onClick={handleRefresh}
              className="text-text-tertiary hover:text-text-secondary p-1 rounded"
              title="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          {config.src && (
            <a
              href={config.src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-tertiary hover:text-text-secondary p-1 rounded"
              title="Open in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Widget content */}
      <div key={refreshKey}>
        {config.type === "iframe" && config.src ? (
          <iframe
            src={config.src}
            className="w-full border-0"
            style={{ height: config.height ?? 300 }}
            sandbox="allow-scripts allow-same-origin"
            title={config.title ?? "Embedded content"}
          />
        ) : WidgetComponent ? (
          <WidgetComponent params={config.params} endpoint={config.endpoint} />
        ) : null}
      </div>
    </div>
  );
}
