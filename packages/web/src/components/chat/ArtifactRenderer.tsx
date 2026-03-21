import { useState, useMemo, useCallback } from "react";
import {
  Download,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ArrowUpDown,
  Play,
  Pause,
  Volume2,
  FileText,
  Image,
  Code,
  BarChart as BarChartIcon,
  Table2,
  Music,
  Video,
  Blocks,
  PenTool,
} from "lucide-react";
import { clsx } from "clsx";
import { CodeBlock } from "../markdown/CodeBlock";
import { DynamicWidget, type WidgetConfig } from "./DynamicWidget";
import { ExcalidrawDiagram } from "./ExcalidrawDiagram";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/Table";
import { Input } from "../ui/Input";

// --- Types ---

export type ArtifactType = "code" | "csv" | "chart" | "image" | "audio" | "video" | "table" | "widget" | "excalidraw";

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface ChartData {
  type: "chart";
  chartType: "bar" | "line" | "pie";
  labels: string[];
  datasets: ChartDataset[];
}

export interface TableData {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface ArtifactData {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  mimeType?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  chartData?: ChartData;
  tableData?: TableData;
}

interface ArtifactRendererProps {
  artifact: ArtifactData;
  className?: string;
}

// --- Type config ---

const typeConfig: Record<ArtifactType, { icon: typeof Code; label: string; color: string }> = {
  code: { icon: Code, label: "Code", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  csv: { icon: Table2, label: "CSV", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  chart: { icon: BarChartIcon, label: "Chart", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  image: { icon: Image, label: "Image", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  audio: { icon: Music, label: "Audio", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  video: { icon: Video, label: "Video", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  table: { icon: Table2, label: "Table", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  widget: { icon: Blocks, label: "Widget", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  excalidraw: { icon: PenTool, label: "Excalidraw", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
};

// --- CSV Table ---

function SortableCSVTable({ csv }: { csv: string }) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => {
    const lines = csv.trim().split("\n").filter(Boolean);
    return lines.map((line) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          cells.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    });
  }, [csv]);

  const [header, ...body] = rows;

  const sortedBody = useMemo(() => {
    if (sortCol === null) return body;
    return [...body].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const numA = Number(va);
      const numB = Number(vb);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortAsc ? numA - numB : numB - numA;
      }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [body, sortCol, sortAsc]);

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(colIndex);
      setSortAsc(true);
    }
  };

  if (!header || header.length === 0) {
    return <p className="p-4 text-sm text-text-tertiary">Empty CSV data</p>;
  }

  return (
    <Table className="text-xs">
      <TableHeader className="bg-surface-tertiary/50">
        <TableRow className="border-b border-border">
          {header.map((cell, i) => (
            <TableHead
              key={i}
              onClick={() => handleSort(i)}
              className="px-3 py-2 text-left font-medium text-text normal-case tracking-normal cursor-pointer hover:bg-surface-tertiary select-none"
            >
              <span className="flex items-center gap-1">
                {cell}
                <ArrowUpDown className="h-3 w-3 text-text-tertiary" />
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedBody.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j} className="px-3 py-1.5 text-text-secondary">
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// --- Simple SVG Chart ---

function SimpleBarChart({ csv }: { csv: string }) {
  const data = useMemo(() => {
    const lines = csv.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const rows = lines.slice(1).map((line) => {
      const parts = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      return { label: parts[0] ?? "", value: Number(parts[1]) || 0 };
    });
    return rows;
  }, [csv]);

  if (data.length === 0) {
    return <p className="p-4 text-sm text-text-tertiary">No chart data available</p>;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(20, Math.min(60, 400 / data.length));
  const chartWidth = data.length * (barWidth + 8) + 40;
  const chartHeight = 200;

  return (
    <div className="p-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
        className="w-full max-w-lg mx-auto"
        style={{ minWidth: `${Math.min(chartWidth, 300)}px` }}
      >
        {/* Bars */}
        {data.map((item, i) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const x = 30 + i * (barWidth + 8);
          const y = chartHeight - barHeight;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                className="fill-primary/70"
              />
              <text
                x={x + barWidth / 2}
                y={chartHeight + 14}
                textAnchor="middle"
                className="fill-text-tertiary"
                fontSize={9}
              >
                {item.label.length > 8 ? item.label.slice(0, 7) + "..." : item.label}
              </text>
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                className="fill-text-secondary"
                fontSize={8}
              >
                {item.value}
              </text>
            </g>
          );
        })}
        {/* Y axis line */}
        <line x1={28} y1={0} x2={28} y2={chartHeight} className="stroke-border" strokeWidth={1} />
        {/* X axis line */}
        <line x1={28} y1={chartHeight} x2={chartWidth} y2={chartHeight} className="stroke-border" strokeWidth={1} />
      </svg>
    </div>
  );
}

// --- Interactive Chart (structured data: bar, line, pie) ---

import { CHART_COLORS } from "@/constants/chart-colors";

function InteractiveChart({ data }: { data: ChartData }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getColor = (i: number, customColor?: string) =>
    customColor ?? CHART_COLORS[i % CHART_COLORS.length];

  if (data.chartType === "pie") {
    return <PieChart data={data} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} getColor={getColor} />;
  }

  if (data.chartType === "line") {
    return <LineChart data={data} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} getColor={getColor} />;
  }

  // Default: bar chart
  return <BarChart data={data} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} getColor={getColor} />;
}

function BarChart({
  data,
  hoveredIndex,
  setHoveredIndex,
  getColor,
}: {
  data: ChartData;
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
  getColor: (i: number, c?: string) => string;
}) {
  const allValues = data.datasets.flatMap((ds) => ds.data);
  const maxValue = Math.max(...allValues, 1);
  const datasetCount = data.datasets.length;
  const labelCount = data.labels.length;
  const groupWidth = Math.max(30, Math.min(80, 500 / labelCount));
  const barWidth = Math.max(8, (groupWidth - 8) / datasetCount);
  const padding = 50;
  const chartWidth = labelCount * (groupWidth + 12) + padding + 20;
  const chartHeight = 200;

  return (
    <div className="p-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 50}`}
        className="w-full max-w-2xl mx-auto"
        style={{ minWidth: `${Math.min(chartWidth, 300)}px` }}
      >
        {/* Grid lines */}
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

        {/* Bars */}
        {data.labels.map((label, li) => {
          const groupX = padding + li * (groupWidth + 12);
          return (
            <g key={li}>
              {data.datasets.map((ds, di) => {
                const barH = (ds.data[li] / maxValue) * chartHeight;
                const x = groupX + di * barWidth;
                const y = chartHeight - barH;
                const isHovered = hoveredIndex === li;
                return (
                  <rect
                    key={di}
                    x={x}
                    y={y}
                    width={barWidth - 2}
                    height={barH}
                    rx={2}
                    fill={getColor(di, ds.color)}
                    opacity={isHovered ? 1 : 0.75}
                    onMouseEnter={() => setHoveredIndex(li)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="transition-opacity duration-150 cursor-pointer"
                  />
                );
              })}
              {/* Label */}
              <text
                x={groupX + (datasetCount * barWidth) / 2}
                y={chartHeight + 14}
                textAnchor="middle"
                className="fill-text-tertiary"
                fontSize={9}
              >
                {label.length > 10 ? label.slice(0, 9) + "\u2026" : label}
              </text>
              {/* Tooltip on hover */}
              {hoveredIndex === li && (
                <text
                  x={groupX + (datasetCount * barWidth) / 2}
                  y={chartHeight - Math.max(...data.datasets.map((ds) => (ds.data[li] / maxValue) * chartHeight)) - 6}
                  textAnchor="middle"
                  className="fill-text"
                  fontSize={9}
                  fontWeight="600"
                >
                  {data.datasets.map((ds) => ds.data[li]).join(" / ")}
                </text>
              )}
            </g>
          );
        })}

        {/* Axes */}
        <line x1={padding} y1={0} x2={padding} y2={chartHeight} className="stroke-border" strokeWidth={1} />
        <line x1={padding} y1={chartHeight} x2={chartWidth - 10} y2={chartHeight} className="stroke-border" strokeWidth={1} />

        {/* Legend */}
        {data.datasets.length > 1 &&
          data.datasets.map((ds, di) => (
            <g key={di} transform={`translate(${padding + di * 100}, ${chartHeight + 30})`}>
              <rect width={10} height={10} rx={2} fill={getColor(di, ds.color)} />
              <text x={14} y={9} className="fill-text-secondary" fontSize={9}>{ds.label}</text>
            </g>
          ))}
      </svg>
    </div>
  );
}

function LineChart({
  data,
  hoveredIndex,
  setHoveredIndex,
  getColor,
}: {
  data: ChartData;
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
  getColor: (i: number, c?: string) => string;
}) {
  const allValues = data.datasets.flatMap((ds) => ds.data);
  const maxValue = Math.max(...allValues, 1);
  const labelCount = data.labels.length;
  const padding = 50;
  const chartWidth = Math.max(300, labelCount * 60 + padding + 20);
  const chartHeight = 200;
  const stepX = labelCount > 1 ? (chartWidth - padding - 20) / (labelCount - 1) : 0;

  return (
    <div className="p-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 50}`}
        className="w-full max-w-2xl mx-auto"
        style={{ minWidth: `${Math.min(chartWidth, 300)}px` }}
      >
        {/* Grid lines */}
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

        {/* Lines + dots */}
        {data.datasets.map((ds, di) => {
          const points = ds.data.map((val, i) => ({
            x: padding + i * stepX,
            y: chartHeight - (val / maxValue) * chartHeight,
          }));
          const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          const color = getColor(di, ds.color);

          return (
            <g key={di}>
              <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIndex === i ? 5 : 3}
                  fill={color}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))}
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.labels.map((label, i) => (
          <text
            key={i}
            x={padding + i * stepX}
            y={chartHeight + 14}
            textAnchor="middle"
            className="fill-text-tertiary"
            fontSize={9}
          >
            {label.length > 10 ? label.slice(0, 9) + "\u2026" : label}
          </text>
        ))}

        {/* Hover tooltip */}
        {hoveredIndex !== null && (
          <text
            x={padding + hoveredIndex * stepX}
            y={Math.min(...data.datasets.map((ds) => chartHeight - (ds.data[hoveredIndex] / maxValue) * chartHeight)) - 8}
            textAnchor="middle"
            className="fill-text"
            fontSize={9}
            fontWeight="600"
          >
            {data.datasets.map((ds) => ds.data[hoveredIndex]).join(" / ")}
          </text>
        )}

        {/* Axes */}
        <line x1={padding} y1={0} x2={padding} y2={chartHeight} className="stroke-border" strokeWidth={1} />
        <line x1={padding} y1={chartHeight} x2={chartWidth - 10} y2={chartHeight} className="stroke-border" strokeWidth={1} />

        {/* Legend */}
        {data.datasets.length > 1 &&
          data.datasets.map((ds, di) => (
            <g key={di} transform={`translate(${padding + di * 100}, ${chartHeight + 30})`}>
              <rect width={10} height={10} rx={2} fill={getColor(di, ds.color)} />
              <text x={14} y={9} className="fill-text-secondary" fontSize={9}>{ds.label}</text>
            </g>
          ))}
      </svg>
    </div>
  );
}

function PieChart({
  data,
  hoveredIndex,
  setHoveredIndex,
  getColor,
}: {
  data: ChartData;
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
  getColor: (i: number, c?: string) => string;
}) {
  // Use first dataset for pie
  const ds = data.datasets[0];
  if (!ds) return <p className="p-4 text-sm text-text-tertiary">No pie data</p>;

  const total = ds.data.reduce((sum, v) => sum + v, 0) || 1;
  const cx = 150;
  const cy = 130;
  const radius = 100;
  const hoverGrow = 8;

  // Build slices
  const slices = useMemo(() => {
    let currentAngle = -Math.PI / 2;
    return ds.data.map((value, i) => {
      const angle = (value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      return { value, startAngle, endAngle, label: data.labels[i] ?? `${i}` };
    });
  }, [ds.data, total, data.labels]);

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
        {/* Center label on hover */}
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
      {/* Legend */}
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

// --- Data Table (structured data with sort + filter) ---

function DataTable({ tableData }: { tableData: TableData }) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState("");

  const filteredRows = useMemo(() => {
    if (!filter.trim()) return tableData.rows;
    const lower = filter.toLowerCase();
    return tableData.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(lower)),
    );
  }, [tableData.rows, filter]);

  const sortedRows = useMemo(() => {
    if (sortCol === null) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const numA = Number(va);
      const numB = Number(vb);
      if (!isNaN(numA) && va !== "" && !isNaN(numB) && vb !== "") {
        return sortAsc ? numA - numB : numB - numA;
      }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filteredRows, sortCol, sortAsc]);

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(colIndex);
      setSortAsc(true);
    }
  };

  if (!tableData.headers.length) {
    return <p className="p-4 text-sm text-text-tertiary">Empty table</p>;
  }

  return (
    <div>
      {/* Filter input */}
      <div className="px-3 py-2 border-b border-border">
        <Input
          type="text"
          placeholder="Filter rows\u2026"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-auto max-w-xs text-xs px-2 py-1"
        />
      </div>
      <Table className="text-xs">
        <TableHeader className="bg-surface-tertiary/50">
          <TableRow className="border-b border-border">
            {tableData.headers.map((header, i) => (
              <TableHead
                key={i}
                onClick={() => handleSort(i)}
                className="px-3 py-2 text-left font-medium text-text normal-case tracking-normal cursor-pointer hover:bg-surface-tertiary select-none"
              >
                <span className="flex items-center gap-1">
                  {header}
                  <ArrowUpDown
                    className={clsx(
                      "h-3 w-3",
                      sortCol === i ? "text-primary" : "text-text-tertiary",
                    )}
                  />
                  {sortCol === i && (
                    <span className="text-[9px] text-primary">{sortAsc ? "\u25B2" : "\u25BC"}</span>
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={tableData.headers.length} className="px-3 py-4 text-center text-text-tertiary">
                No matching rows
              </TableCell>
            </TableRow>
          ) : (
            sortedRows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j} className="px-3 py-1.5 text-text-secondary">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {/* Row count */}
      <div className="px-3 py-1.5 text-[10px] text-text-tertiary border-t border-border">
        {sortedRows.length} of {tableData.rows.length} row{tableData.rows.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// --- Main Component ---

export function ArtifactRenderer({ artifact, className }: ArtifactRendererProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const config = typeConfig[artifact.type] ?? typeConfig.code;
  const Icon = config.icon;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [artifact.content]);

  const handleDownload = useCallback(() => {
    if (artifact.url) {
      window.open(artifact.url, "_blank");
      return;
    }
    const mimeMap: Record<string, string> = {
      code: "text/plain",
      csv: "text/csv",
      chart: "text/csv",
      table: "text/csv",
      image: artifact.mimeType ?? "image/png",
      audio: artifact.mimeType ?? "audio/mpeg",
      video: artifact.mimeType ?? "video/mp4",
      excalidraw: "application/json",
    };
    const mime = mimeMap[artifact.type] ?? "text/plain";

    // For structured table data, generate CSV content for download
    let downloadContent = artifact.content;
    if (artifact.type === "table" && artifact.tableData) {
      const csvLines = [
        artifact.tableData.headers.join(","),
        ...artifact.tableData.rows.map((row) =>
          row.map((cell) => (cell.includes(",") ? `"${cell}"` : cell)).join(","),
        ),
      ];
      downloadContent = csvLines.join("\n");
    }

    const blob = new Blob([downloadContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const extMap: Record<string, string> = { code: "txt", csv: "csv", chart: "csv", table: "csv", excalidraw: "excalidraw" };
    const ext = extMap[artifact.type] ?? artifact.type;
    a.download = `${artifact.title || "artifact"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [artifact]);

  return (
    <div
      className={clsx(
        "rounded-xl border border-border overflow-hidden bg-surface-secondary my-2",
        fullscreen && "fixed inset-4 z-50 shadow-2xl flex flex-col",
        className,
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-tertiary/50">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-text truncate">
            {artifact.title}
          </span>
          <span className={clsx("text-[10px] px-1.5 py-0.5 rounded border shrink-0", config.color)}>
            {config.label}
          </span>
          {artifact.language && (
            <span className="text-[10px] text-text-tertiary bg-surface px-1.5 py-0.5 rounded border border-border shrink-0">
              {artifact.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className="text-text-tertiary hover:text-text-secondary p-1 rounded"
            title="Copy content"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleDownload}
            className="text-text-tertiary hover:text-text-secondary p-1 rounded"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="text-text-tertiary hover:text-text-secondary p-1 rounded"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={clsx(
        fullscreen ? "flex-1 overflow-auto" : artifact.type === "excalidraw" ? "overflow-hidden" : "overflow-auto max-h-[500px]",
      )}>
        {/* Code with syntax highlighting */}
        {artifact.type === "code" && (
          <CodeBlock code={artifact.content} language={artifact.language ?? "text"} />
        )}

        {/* CSV as sortable table */}
        {artifact.type === "csv" && (
          <SortableCSVTable csv={artifact.content} />
        )}

        {/* Chart: use structured chartData if available, fall back to CSV bar chart */}
        {artifact.type === "chart" && (
          artifact.chartData
            ? <InteractiveChart data={artifact.chartData} />
            : <SimpleBarChart csv={artifact.content} />
        )}

        {/* Structured table with sort + filter */}
        {artifact.type === "table" && artifact.tableData && (
          <DataTable tableData={artifact.tableData} />
        )}

        {/* Image display */}
        {artifact.type === "image" && (
          <div className="p-4 flex justify-center">
            <img
              src={artifact.url ?? `data:${artifact.mimeType ?? "image/png"};base64,${artifact.content}`}
              alt={artifact.title}
              className="max-w-full max-h-[400px] object-contain rounded-lg"
            />
          </div>
        )}

        {/* Audio inline player */}
        {artifact.type === "audio" && (
          <div className="p-4 flex flex-col items-center gap-3">
            <Volume2 className="h-8 w-8 text-text-tertiary" />
            <audio
              controls
              className="w-full max-w-md"
              src={artifact.url ?? `data:${artifact.mimeType ?? "audio/mpeg"};base64,${artifact.content}`}
            >
              Your browser does not support the audio element.
            </audio>
            <p className="text-xs text-text-tertiary">{artifact.title}</p>
          </div>
        )}

        {/* Video inline player */}
        {artifact.type === "video" && (
          <div className="p-4 flex justify-center">
            <video
              controls
              className="w-full max-w-lg rounded-lg"
              src={artifact.url ?? `data:${artifact.mimeType ?? "video/mp4"};base64,${artifact.content}`}
            >
              Your browser does not support the video element.
            </video>
          </div>
        )}

        {/* Excalidraw diagram */}
        {artifact.type === "excalidraw" && (
          <ExcalidrawDiagram
            artifactId={artifact.id}
            initialScene={artifact.content}
            fullscreen={fullscreen}
          />
        )}

        {/* Dynamic widget */}
        {artifact.type === "widget" && artifact.metadata && (
          <DynamicWidget config={artifact.metadata as unknown as WidgetConfig} artifactId={artifact.id} />
        )}
      </div>

      {/* Fullscreen backdrop */}
      {fullscreen && (
        <div
          className="fixed inset-0 bg-overlay -z-10"
          onClick={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}
