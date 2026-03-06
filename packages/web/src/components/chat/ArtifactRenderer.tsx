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
  BarChart,
  Table2,
  Music,
  Video,
} from "lucide-react";
import { clsx } from "clsx";
import { CodeBlock } from "../markdown/CodeBlock";

// --- Types ---

type ArtifactType = "code" | "csv" | "chart" | "image" | "audio" | "video";

interface ArtifactData {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  mimeType?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

interface ArtifactRendererProps {
  artifact: ArtifactData;
  className?: string;
}

// --- Type config ---

const typeConfig: Record<ArtifactType, { icon: typeof Code; label: string; color: string }> = {
  code: { icon: Code, label: "Code", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  csv: { icon: Table2, label: "CSV", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  chart: { icon: BarChart, label: "Chart", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  image: { icon: Image, label: "Image", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  audio: { icon: Music, label: "Audio", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  video: { icon: Video, label: "Video", color: "bg-red-500/10 text-red-400 border-red-500/20" },
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
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-tertiary/50">
            {header.map((cell, i) => (
              <th
                key={i}
                onClick={() => handleSort(i)}
                className="px-3 py-2 text-left font-medium text-text border-b border-border cursor-pointer hover:bg-surface-tertiary select-none"
              >
                <span className="flex items-center gap-1">
                  {cell}
                  <ArrowUpDown className="h-3 w-3 text-text-tertiary" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedBody.map((row, i) => (
            <tr key={i} className="hover:bg-surface-secondary/50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-text-secondary border-b border-border">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      image: artifact.mimeType ?? "image/png",
      audio: artifact.mimeType ?? "audio/mpeg",
      video: artifact.mimeType ?? "video/mp4",
    };
    const mime = mimeMap[artifact.type] ?? "text/plain";
    const blob = new Blob([artifact.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const extMap: Record<string, string> = { code: "txt", csv: "csv", chart: "csv" };
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
      <div className={clsx("overflow-auto", fullscreen ? "flex-1" : "max-h-[500px]")}>
        {/* Code with syntax highlighting */}
        {artifact.type === "code" && (
          <CodeBlock code={artifact.content} language={artifact.language ?? "text"} />
        )}

        {/* CSV as sortable table */}
        {artifact.type === "csv" && (
          <SortableCSVTable csv={artifact.content} />
        )}

        {/* Chart as simple SVG bar chart */}
        {artifact.type === "chart" && (
          <SimpleBarChart csv={artifact.content} />
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
      </div>

      {/* Fullscreen backdrop */}
      {fullscreen && (
        <div
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}
