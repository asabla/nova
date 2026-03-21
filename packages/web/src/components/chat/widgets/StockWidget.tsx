import clsx from "clsx";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

const RANGE_LABELS: Record<string, string> = {
  "1d": "1 Day",
  "5d": "5 Days",
  "1m": "1 Month",
  "3m": "3 Months",
};

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;

  const width = 300;
  const height = 60;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const firstPoint = `${padding},${height}`;
  const lastPoint = `${padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)},${height}`;
  const fillPoints = `${firstPoint} ${points} ${lastPoint}`;

  const color = positive ? "#22c55e" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 60 }}>
      <polygon points={fillPoints} fill={color} fillOpacity={0.1} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}

export function StockWidget({ params }: { params?: Record<string, string> }) {
  const symbol = params?.symbol;
  const price = params?.price;
  const change = params?.change ? Number(params.change) : undefined;
  const changePercent = params?.changePercent;
  const range = params?.range ?? "1d";
  const sparklineData = params?.sparkline
    ? params.sparkline.split(",").map(Number).filter((n) => !isNaN(n))
    : [];

  if (!symbol || !price) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-text-secondary">
        <Activity className="h-4 w-4 shrink-0" />
        <span>{symbol ? `${symbol} —` : ""} Data provided by agent</span>
      </div>
    );
  }

  const positive = change !== undefined ? change >= 0 : true;
  const TrendIcon = positive ? TrendingUp : TrendingDown;
  const rangeLabel = RANGE_LABELS[range] ?? range;

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-text">{symbol}</div>
          <div className="text-xs text-text-tertiary">{rangeLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-light text-text">{price}</div>
          {change !== undefined && (
            <div
              className={clsx(
                "flex items-center justify-end gap-1 text-sm font-medium",
                positive ? "text-green-500" : "text-red-500",
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              <span>
                {positive ? "+" : ""}
                {change.toFixed(2)}
                {changePercent ? ` (${changePercent})` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {sparklineData.length >= 2 && (
        <div className="rounded-md overflow-hidden bg-surface-secondary">
          <Sparkline data={sparklineData} positive={positive} />
        </div>
      )}
    </div>
  );
}
