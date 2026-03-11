import { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

export function WeatherWidget({ params }: { params?: Record<string, string> }) {
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
