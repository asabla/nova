import { TrendingUp } from "lucide-react";
import type { DailyRow } from "./types";
import { formatNumber, formatCost, formatDate } from "./types";
import { LoadingSkeleton, EmptyState } from "./SummaryCards";

export function UsageChart({
  data,
  loading,
}: {
  data: DailyRow[];
  loading: boolean;
}) {
  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text">
            Token Usage Over Time
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/70" />
            Total Tokens
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-success/70" />
            Cost (cents)
          </span>
        </div>
      </div>
      {loading ? (
        <LoadingSkeleton height="h-52" />
      ) : data.length === 0 ? (
        <EmptyState message="No daily usage data for this period" />
      ) : (
        <TokenLineChart data={data} />
      )}
    </div>
  );
}

function TokenLineChart({ data }: { data: DailyRow[] }) {
  const W = 800;
  const H = 200;
  const PAD = { top: 10, right: 10, bottom: 30, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxTokens = Math.max(...data.map((d) => d.totalTokens), 1);
  const maxCost = Math.max(...data.map((d) => d.costCents), 1);

  const tokenPoints = data.map((d, i) => {
    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
    const y = PAD.top + plotH - (d.totalTokens / maxTokens) * plotH;
    return `${x},${y}`;
  });

  const costPoints = data.map((d, i) => {
    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
    const y = PAD.top + plotH - (d.costCents / maxCost) * plotH;
    return `${x},${y}`;
  });

  const tokenFillPoints = [
    `${PAD.left},${PAD.top + plotH}`,
    ...tokenPoints,
    `${PAD.left + plotW},${PAD.top + plotH}`,
  ].join(" ");

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: formatNumber(Math.round(maxTokens * pct)),
    y: PAD.top + plotH - pct * plotH,
  }));

  const xLabelIndices =
    data.length <= 7
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor((3 * data.length) / 4), data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yl.y} x2={PAD.left + plotW} y2={yl.y} className="stroke-border" strokeWidth="0.5" strokeDasharray="4 4" />
          <text x={PAD.left - 6} y={yl.y + 3} textAnchor="end" className="fill-text-tertiary" fontSize="9">{yl.value}</text>
        </g>
      ))}
      {xLabelIndices.map((idx) => {
        const x = PAD.left + (idx / Math.max(data.length - 1, 1)) * plotW;
        return (
          <text key={idx} x={x} y={H - 6} textAnchor="middle" className="fill-text-tertiary" fontSize="9">
            {formatDate(data[idx].date)}
          </text>
        );
      })}
      <polygon points={tokenFillPoints} className="fill-primary/10" />
      <polyline points={tokenPoints.join(" ")} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={costPoints.join(" ")} fill="none" className="stroke-success" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6 3" />
      {data.length <= 31 &&
        data.map((d, i) => {
          const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
          const y = PAD.top + plotH - (d.totalTokens / maxTokens) * plotH;
          return (
            <circle key={i} cx={x} cy={y} r="3" className="fill-primary stroke-surface" strokeWidth="1.5">
              <title>{formatDate(d.date)}: {formatNumber(d.totalTokens)} tokens, {formatCost(d.costCents)}</title>
            </circle>
          );
        })}
    </svg>
  );
}
