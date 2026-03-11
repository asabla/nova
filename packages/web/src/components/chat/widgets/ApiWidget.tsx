import { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

export function ApiWidget({ endpoint, params }: { endpoint: string; params?: Record<string, string> }) {
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
