import { useState, useMemo } from "react";
import { CHART_COLORS } from "@/constants/chart-colors";

export function ChartWidget({ params }: { params?: Record<string, string> }) {
  const chartType = (params?.chartType ?? "bar") as "bar" | "line" | "pie";
  const dataValues = useMemo(
    () => (params?.data ?? "").split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)),
    [params?.data],
  );
  const labels = useMemo(
    () => (params?.labels ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    [params?.labels],
  );

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getColor = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

  if (dataValues.length === 0) {
    return <p className="p-4 text-sm text-text-tertiary">No chart data provided</p>;
  }

  // Ensure labels match data length
  const resolvedLabels = dataValues.map((_, i) => labels[i] ?? `${i + 1}`);

  if (chartType === "pie") {
    return <PieSlice data={dataValues} labels={resolvedLabels} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} getColor={getColor} />;
  }

  if (chartType === "line") {
    return <LineSlice data={dataValues} labels={resolvedLabels} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} getColor={getColor} />;
  }

  return <BarSlice data={dataValues} labels={resolvedLabels} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} getColor={getColor} />;
}

// --- Bar ---

function BarSlice({
  data,
  labels,
  hoveredIndex,
  setHoveredIndex,
  getColor,
}: {
  data: number[];
  labels: string[];
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
  getColor: (i: number) => string;
}) {
  const maxValue = Math.max(...data, 1);
  const barWidth = Math.max(20, Math.min(60, 400 / data.length));
  const padding = 50;
  const chartWidth = data.length * (barWidth + 12) + padding + 20;
  const chartHeight = 200;

  return (
    <div className="p-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}
        className="w-full max-w-2xl mx-auto"
        style={{ minWidth: `${Math.min(chartWidth, 300)}px` }}
      >
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = chartHeight - frac * chartHeight;
          return (
            <g key={frac}>
              <line x1={padding} y1={y} x2={chartWidth - 10} y2={y} stroke="currentColor" className="text-border" strokeWidth={0.5} strokeDasharray={frac > 0 ? "3,3" : undefined} />
              <text x={padding - 6} y={y + 3} textAnchor="end" className="fill-text-tertiary" fontSize={8}>
                {Math.round(maxValue * frac)}
              </text>
            </g>
          );
        })}

        {data.map((value, i) => {
          const barH = (value / maxValue) * chartHeight;
          const x = padding + i * (barWidth + 12);
          const y = chartHeight - barH;
          const isHovered = hoveredIndex === i;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={3}
                fill={getColor(i)}
                opacity={isHovered ? 1 : 0.75}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="transition-opacity duration-150 cursor-pointer"
              />
              <text x={x + barWidth / 2} y={chartHeight + 14} textAnchor="middle" className="fill-text-tertiary" fontSize={9}>
                {labels[i].length > 8 ? labels[i].slice(0, 7) + "\u2026" : labels[i]}
              </text>
              {isHovered && (
                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" className="fill-text" fontSize={9} fontWeight="600">
                  {value}
                </text>
              )}
            </g>
          );
        })}

        <line x1={padding} y1={0} x2={padding} y2={chartHeight} className="stroke-border" strokeWidth={1} />
        <line x1={padding} y1={chartHeight} x2={chartWidth - 10} y2={chartHeight} className="stroke-border" strokeWidth={1} />
      </svg>
    </div>
  );
}

// --- Line ---

function LineSlice({
  data,
  labels,
  hoveredIndex,
  setHoveredIndex,
  getColor,
}: {
  data: number[];
  labels: string[];
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
  getColor: (i: number) => string;
}) {
  const maxValue = Math.max(...data, 1);
  const padding = 50;
  const chartWidth = Math.max(300, data.length * 60 + padding + 20);
  const chartHeight = 200;
  const stepX = data.length > 1 ? (chartWidth - padding - 20) / (data.length - 1) : 0;

  const points = data.map((val, i) => ({
    x: padding + i * stepX,
    y: chartHeight - (val / maxValue) * chartHeight,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="p-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}
        className="w-full max-w-2xl mx-auto"
        style={{ minWidth: `${Math.min(chartWidth, 300)}px` }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = chartHeight - frac * chartHeight;
          return (
            <g key={frac}>
              <line x1={padding} y1={y} x2={chartWidth - 10} y2={y} stroke="currentColor" className="text-border" strokeWidth={0.5} strokeDasharray={frac > 0 ? "3,3" : undefined} />
              <text x={padding - 6} y={y + 3} textAnchor="end" className="fill-text-tertiary" fontSize={8}>
                {Math.round(maxValue * frac)}
              </text>
            </g>
          );
        })}

        <path d={pathD} fill="none" stroke={getColor(0)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 5 : 3}
            fill={getColor(0)}
            className="cursor-pointer transition-all duration-150"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {labels.map((label, i) => (
          <text key={i} x={padding + i * stepX} y={chartHeight + 14} textAnchor="middle" className="fill-text-tertiary" fontSize={9}>
            {label.length > 10 ? label.slice(0, 9) + "\u2026" : label}
          </text>
        ))}

        {hoveredIndex !== null && points[hoveredIndex] && (
          <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 8} textAnchor="middle" className="fill-text" fontSize={9} fontWeight="600">
            {data[hoveredIndex]}
          </text>
        )}

        <line x1={padding} y1={0} x2={padding} y2={chartHeight} className="stroke-border" strokeWidth={1} />
        <line x1={padding} y1={chartHeight} x2={chartWidth - 10} y2={chartHeight} className="stroke-border" strokeWidth={1} />
      </svg>
    </div>
  );
}

// --- Pie ---

function PieSlice({
  data,
  labels,
  hoveredIndex,
  setHoveredIndex,
  getColor,
}: {
  data: number[];
  labels: string[];
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
  getColor: (i: number) => string;
}) {
  const total = data.reduce((sum, v) => sum + v, 0) || 1;
  const cx = 150;
  const cy = 130;
  const radius = 100;
  const hoverGrow = 8;

  const slices = useMemo(() => {
    let currentAngle = -Math.PI / 2;
    return data.map((value, i) => {
      const angle = (value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      return { value, startAngle, endAngle, label: labels[i] ?? `${i}` };
    });
  }, [data, labels, total]);

  const describeArc = (startAngle: number, endAngle: number, r: number) => {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="p-4 overflow-x-auto">
      <svg viewBox="0 0 300 300" className="w-full max-w-xs mx-auto">
        {slices.map((slice, i) => {
          const isHovered = hoveredIndex === i;
          const r = isHovered ? radius + hoverGrow : radius;
          return (
            <path
              key={i}
              d={describeArc(slice.startAngle, slice.endAngle, r)}
              fill={getColor(i)}
              stroke="currentColor"
              className="text-surface-secondary transition-all duration-150 cursor-pointer"
              strokeWidth={2}
              opacity={isHovered ? 1 : 0.85}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}
        {hoveredIndex !== null && slices[hoveredIndex] && (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-text" fontSize={12} fontWeight="600">
              {slices[hoveredIndex].label}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" className="fill-text-secondary" fontSize={10}>
              {slices[hoveredIndex].value} ({Math.round((slices[hoveredIndex].value / total) * 100)}%)
            </text>
          </>
        )}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {slices.map((slice, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getColor(i) }} />
            {slice.label}
          </div>
        ))}
      </div>
    </div>
  );
}
