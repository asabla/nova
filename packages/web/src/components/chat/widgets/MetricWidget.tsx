import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { clsx } from "clsx";
import { useMemo } from "react";

interface Metric {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
}

export function MetricWidget({ params }: { params?: Record<string, string> }) {
  const metrics = useMemo<Metric[]>(() => {
    if (!params?.metrics) return [];
    try {
      const raw = params.metrics;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return [];
    }
  }, [params?.metrics]);

  if (metrics.length === 0) {
    return <p className="p-4 text-sm text-text-tertiary">No metrics data provided</p>;
  }

  return (
    <div className="px-4 py-3">
      <div
        className={clsx(
          "grid gap-3",
          metrics.length === 1 && "grid-cols-1",
          metrics.length === 2 && "grid-cols-2",
          metrics.length >= 3 && "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {metrics.map((metric, i) => (
          <div key={i} className="bg-surface-tertiary/50 rounded-lg px-3 py-2.5">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wide font-medium">
              {metric.label}
            </div>
            <div className="text-lg font-semibold text-text">{metric.value}</div>
            {metric.change && (
              <div className="flex items-center gap-1 text-xs font-medium mt-0.5">
                {metric.trend === "up" ? (
                  <>
                    <TrendingUp className="size-3 text-green-500" />
                    <span className="text-green-500">{metric.change}</span>
                  </>
                ) : metric.trend === "down" ? (
                  <>
                    <TrendingDown className="size-3 text-red-500" />
                    <span className="text-red-500">{metric.change}</span>
                  </>
                ) : (
                  <>
                    <Minus className="size-3 text-text-tertiary" />
                    <span className="text-text-tertiary">{metric.change}</span>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
