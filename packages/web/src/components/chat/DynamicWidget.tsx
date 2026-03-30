import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import { WIDGET_REGISTRY } from "./widgets/registry";
import { WidgetErrorBoundary } from "./widgets/WidgetErrorBoundary";
import { parseWidgetConfig } from "./widgets/schemas";

/**
 * Dynamic Widget component (Story #131).
 * Renders embeddable widgets within conversations for live data display.
 */

export interface WidgetConfig {
  type: "weather" | "iframe" | "api" | "countdown" | "poll" | "chart" | "progress" | "timer" | "map" | "math" | "diff" | "timeline" | "checklist" | "colorpalette" | "qrcode" | "calendar" | "dice" | "unitconverter" | "currency" | "stock" | "kanban" | "quiz" | "jsonexplorer" | "youtube" | "codedisplay" | "table" | "comparison" | "proscons" | "metric" | "flashcard" | "rating" | "glossary" | "matrix";
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

/**
 * Param aliases the agent may use instead of the canonical param name.
 * Maps widgetType -> { aliasName -> canonicalName }.
 */
const PARAM_ALIASES: Record<string, Record<string, string>> = {
  qrcode: { text: "data", content: "data", url: "data", value: "data" },
  weather: { city: "location", place: "location" },
  youtube: { id: "videoId", video: "videoId" },
  map: { latitude: "lat", longitude: "lon", label: "query" },
  math: { formula: "expression", latex: "expression", eq: "expression" },
  diff: { before: "original", after: "modified", old: "original", new: "modified" },
  codedisplay: { lang: "language", result: "output" },
  colorpalette: { palette: "colors" },
  stock: { ticker: "symbol" },
};

/**
 * Normalize widget params so widgets always receive consistent data.
 * Handles: type coercion, param aliases, array→CSV, object→JSON string.
 */
function normalizeParams(
  type: string,
  raw: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!raw) return undefined;

  const aliases = PARAM_ALIASES[type];
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    // Resolve alias → canonical name
    const canonicalKey = aliases?.[key] ?? key;

    // Don't overwrite a canonical key that's already set
    if (canonicalKey !== key && canonicalKey in raw) {
      // The canonical key exists in the raw params, skip the alias
      continue;
    }

    if (value == null) continue;

    if (typeof value === "string") {
      result[canonicalKey] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      result[canonicalKey] = String(value);
    } else if (Array.isArray(value)) {
      // Always JSON.stringify arrays for consistency — widgets use
      // parseArrayParam() to handle both JSON and legacy CSV formats
      result[canonicalKey] = JSON.stringify(value);
    } else if (typeof value === "object") {
      result[canonicalKey] = JSON.stringify(value);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/** Compact fallback shown when widget config is invalid. */
function WidgetInvalidFallback({ error, raw }: { error: string; raw: unknown }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-warning">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>{error}</span>
      </div>
      {raw != null && (
        <details className="mt-2">
          <summary className="text-[10px] text-text-tertiary cursor-pointer hover:text-text-secondary">
            Raw config
          </summary>
          <pre className="mt-1 text-[10px] text-text-tertiary bg-surface-tertiary/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

interface DynamicWidgetProps {
  config: WidgetConfig;
  className?: string;
  artifactId?: string;
}

export function DynamicWidget({ config, className, artifactId }: DynamicWidgetProps) {
  // Validate config structure
  const validation = useMemo(() => parseWidgetConfig(config), [config]);

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

  // Normalize params: coerce types, resolve aliases
  const normalizedParams = useMemo(
    () => normalizeParams(config.type, config.params as Record<string, unknown>),
    [config.type, config.params],
  );

  // Show validation error fallback
  if (!validation.ok) {
    return (
      <div
        className={clsx(
          "rounded-xl border border-border overflow-hidden bg-surface-secondary my-2",
          className,
        )}
      >
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-tertiary/50">
          <span className="text-xs font-medium text-text truncate">
            {(config as Record<string, unknown>).type
              ? String((config as Record<string, unknown>).type)
              : "widget"}
          </span>
        </div>
        <WidgetInvalidFallback error={validation.error} raw={validation.raw} />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-xl border border-border overflow-hidden bg-surface-secondary my-2",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-tertiary/50">
        <span className="text-xs font-medium text-text truncate" title={config.title ?? config.type}>
          {config.title ?? config.type}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {config.type !== "iframe" && (
            <button
              onClick={handleRefresh}
              className="text-text-tertiary hover:text-text-secondary p-1 rounded"
              title="Refresh"
              aria-label="Refresh"
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
        {config.type === "iframe" && (config.src || normalizedParams?.src) ? (
          <iframe
            src={config.src ?? normalizedParams?.src}
            className="w-full border-0"
            style={{ height: config.height ?? (normalizedParams?.height ? Number(normalizedParams.height) : 300) }}
            sandbox="allow-scripts allow-same-origin"
            title={config.title ?? "Embedded content"}
          />
        ) : WidgetComponent ? (
          <WidgetErrorBoundary widgetType={config.type}>
            <WidgetComponent params={normalizedParams} endpoint={config.endpoint} artifactId={artifactId} />
          </WidgetErrorBoundary>
        ) : (
          <WidgetInvalidFallback
            error={`Unsupported widget type "${config.type}"`}
            raw={config}
          />
        )}
      </div>
    </div>
  );
}
