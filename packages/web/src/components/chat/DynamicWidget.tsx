import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
/**
 * Dynamic Widget component (Story #131).
 * Renders embeddable widgets within conversations for live data display.
 * Supports: weather, stock quotes, iframe embeds, and custom API widgets.
 */

export interface WidgetConfig {
  type: "weather" | "iframe" | "api" | "countdown" | "poll";
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

// --- Weather Widget ---

function WeatherWidget({ params }: { params?: Record<string, string> }) {
  const [data, setData] = useState<{
    temp?: string;
    condition?: string;
    location?: string;
    humidity?: string;
    wind?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const location = params?.location ?? params?.city ?? "London";

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Use wttr.in free weather API (no key required)
    fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: any) => {
        const current = json?.current_condition?.[0];
        setData({
          temp: current?.temp_C ? `${current.temp_C}°C` : undefined,
          condition: current?.weatherDesc?.[0]?.value,
          location: json?.nearest_area?.[0]?.areaName?.[0]?.value ?? location,
          humidity: current?.humidity ? `${current.humidity}%` : undefined,
          wind: current?.windspeedKmph ? `${current.windspeedKmph} km/h` : undefined,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [location]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <RefreshCw className="h-5 w-5 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-warning">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Could not load weather: {error ?? "No data"}</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 flex items-center gap-4">
      <div className="text-3xl font-light text-text">{data.temp}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">{data.location}</div>
        <div className="text-xs text-text-secondary">{data.condition}</div>
        <div className="text-xs text-text-tertiary mt-0.5">
          Humidity: {data.humidity} &middot; Wind: {data.wind}
        </div>
      </div>
    </div>
  );
}

// --- Countdown Widget ---

function CountdownWidget({ params }: { params?: Record<string, string> }) {
  const targetDate = params?.date ? new Date(params.date) : new Date(Date.now() + 86400000);
  const label = params?.label ?? "Countdown";

  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Completed!");
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      parts.push(`${hours}h`, `${minutes}m`, `${seconds}s`);
      setRemaining(parts.join(" "));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="px-4 py-3 text-center">
      <div className="text-xs text-text-tertiary mb-1">{label}</div>
      <div className="text-2xl font-mono font-light text-text">{remaining}</div>
    </div>
  );
}

// --- Poll Widget ---

function PollWidget({ params }: { params?: Record<string, string> }) {
  const question = params?.question ?? "What do you think?";
  const options = (params?.options ?? "Yes,No,Maybe").split(",").map((s) => s.trim());
  const [votes, setVotes] = useState<number[]>(() => options.map(() => 0));
  const [voted, setVoted] = useState(false);

  const totalVotes = votes.reduce((a, b) => a + b, 0);

  const handleVote = (index: number) => {
    if (voted) return;
    setVotes((prev) => prev.map((v, i) => (i === index ? v + 1 : v)));
    setVoted(true);
  };

  return (
    <div className="px-4 py-3">
      <div className="text-sm font-medium text-text mb-2">{question}</div>
      <div className="space-y-1.5">
        {options.map((option, i) => {
          const pct = totalVotes > 0 ? Math.round((votes[i] / totalVotes) * 100) : 0;
          return (
            <button
              key={i}
              onClick={() => handleVote(i)}
              disabled={voted}
              className={clsx(
                "w-full text-left px-3 py-1.5 rounded-lg border text-xs transition-all relative overflow-hidden",
                voted
                  ? "border-border cursor-default"
                  : "border-primary/30 hover:border-primary cursor-pointer",
              )}
            >
              {voted && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between">
                <span className="text-text">{option}</span>
                {voted && (
                  <span className="text-text-tertiary">{pct}%</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {voted && (
        <div className="text-[10px] text-text-tertiary mt-1.5">{totalVotes} vote(s)</div>
      )}
    </div>
  );
}

// --- API Data Widget ---

function ApiWidget({ endpoint, params }: { endpoint: string; params?: Record<string, string> }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const url = new URL(endpoint, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [endpoint, params]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <RefreshCw className="h-4 w-4 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 text-xs text-danger flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Failed to load: {error}</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <pre className="text-xs text-text-secondary overflow-auto max-h-60 whitespace-pre-wrap">
        {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// --- Main Widget Component ---

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
        {config.type === "weather" && <WeatherWidget params={config.params} />}

        {config.type === "countdown" && <CountdownWidget params={config.params} />}

        {config.type === "poll" && <PollWidget params={config.params} />}

        {config.type === "api" && config.endpoint && (
          <ApiWidget endpoint={config.endpoint} params={config.params} />
        )}

        {config.type === "iframe" && config.src && (
          <iframe
            src={config.src}
            className="w-full border-0"
            style={{ height: config.height ?? 300 }}
            sandbox="allow-scripts allow-same-origin"
            title={config.title ?? "Embedded content"}
          />
        )}
      </div>
    </div>
  );
}
