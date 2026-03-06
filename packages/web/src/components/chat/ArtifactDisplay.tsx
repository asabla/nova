import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Download,
  Maximize2,
  Minimize2,
  Save,
  FileText,
  Image,
  Code,
  BarChart,
  Table2,
  GitBranch,
  Globe,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  ArrowUpDown,
} from "lucide-react";
import { clsx } from "clsx";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { toast } from "../ui/Toast";
import { CodeBlock } from "../markdown/CodeBlock";

interface Artifact {
  id: string;
  type: "code" | "image" | "document" | "chart" | "table" | "mermaid" | "html" | "audio" | "video";
  title: string;
  content: string;
  language?: string;
  mimeType?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

interface ArtifactDisplayProps {
  artifact: Artifact;
  onSave?: (artifactId: string) => void;
}

const typeIcons: Record<string, typeof Code> = {
  code: Code,
  image: Image,
  document: FileText,
  chart: BarChart,
  table: Table2,
  mermaid: GitBranch,
  html: Globe,
  audio: FileText,
  video: FileText,
};

const typeBadgeColors: Record<string, string> = {
  code: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  image: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  chart: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  table: "bg-green-500/10 text-green-400 border-green-500/20",
  mermaid: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  html: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  document: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

// -- Sub-components --

function MermaidArtifact({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useMemo(() => `mermaid-${Math.random().toString(36).slice(2, 9)}`, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = `<pre class="text-xs text-danger p-2">Failed to render diagram</pre>`;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [code, id]);

  return (
    <div className="p-4 flex justify-center overflow-x-auto">
      <div ref={ref} />
    </div>
  );
}

function SortableTable({ csv }: { csv: string }) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => {
    const lines = csv.trim().split("\n").filter(Boolean);
    return lines.map((line) =>
      line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")),
    );
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

  const handleDownloadCsv = useCallback(() => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [csv]);

  if (!header || header.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-end px-3 py-1 border-b border-border">
        <button
          onClick={handleDownloadCsv}
          className="text-[10px] text-text-tertiary hover:text-text-secondary flex items-center gap-1"
        >
          <Download className="h-3 w-3" /> CSV
        </button>
      </div>
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

function HtmlPreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      className="w-full h-64 bg-white border-0"
      title="HTML Preview"
    />
  );
}

function ImageDisplay({ url, alt }: { url: string; alt: string }) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="relative overflow-auto">
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
          className="p-1 rounded bg-surface/80 text-text-tertiary hover:text-text-secondary"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
          className="p-1 rounded bg-surface/80 text-text-tertiary hover:text-text-secondary"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
      </div>
      <img
        src={url}
        alt={alt}
        className="transition-transform origin-top-left"
        style={{ transform: `scale(${zoom})` }}
      />
    </div>
  );
}

// -- Main Component --

export function ArtifactDisplay({ artifact, onSave }: ArtifactDisplayProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const Icon = typeIcons[artifact.type] ?? FileText;
  const badgeColor = typeBadgeColors[artifact.type] ?? typeBadgeColors.document;

  const saveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/artifacts/${id}/save`),
    onSuccess: () => toast.success("Saved to library"),
    onError: () => toast.error("Failed to save artifact"),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (artifact.url) {
      window.open(artifact.url, "_blank");
      return;
    }
    const blob = new Blob([artifact.content], { type: artifact.mimeType ?? "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.title || "artifact";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(artifact.id);
    } else {
      saveMutation.mutate(artifact.id);
    }
  };

  return (
    <div
      className={clsx(
        "rounded-xl border border-border overflow-hidden bg-surface-secondary my-2",
        fullscreen && "fixed inset-4 z-50 shadow-2xl flex flex-col",
      )}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-tertiary/50">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-text truncate">
            {artifact.title}
          </span>
          <span
            className={clsx(
              "text-[10px] px-1.5 py-0.5 rounded border shrink-0",
              badgeColor,
            )}
          >
            {artifact.type}
          </span>
          {artifact.language && (
            <span className="text-[10px] text-text-tertiary bg-surface px-1.5 py-0.5 rounded border border-border shrink-0">
              {artifact.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleCopy} className="text-text-tertiary hover:text-text-secondary p-1 rounded" title="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button onClick={handleSave} className="text-text-tertiary hover:text-text-secondary p-1 rounded" title="Save to library" disabled={saveMutation.isPending}>
            <Save className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleDownload} className="text-text-tertiary hover:text-text-secondary p-1 rounded" title="Download">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-text-tertiary hover:text-text-secondary p-1 rounded"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
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

      {/* Content area */}
      {!collapsed && (
        <div className={clsx("overflow-auto", fullscreen ? "flex-1" : "max-h-[400px]")}>
          {/* Code artifacts */}
          {artifact.type === "code" && (
            <CodeBlock code={artifact.content} language={artifact.language ?? "text"} />
          )}

          {/* Chart artifacts */}
          {artifact.type === "chart" && (
            <div className="p-4 flex items-center justify-center text-text-tertiary text-sm">
              <BarChart className="h-8 w-8 mr-2 opacity-50" />
              Chart rendering (requires chart.js integration)
            </div>
          )}

          {/* Table artifacts */}
          {artifact.type === "table" && (
            <SortableTable csv={artifact.content} />
          )}

          {/* Mermaid artifacts */}
          {artifact.type === "mermaid" && (
            <MermaidArtifact code={artifact.content} />
          )}

          {/* HTML artifacts */}
          {artifact.type === "html" && (
            <HtmlPreview html={artifact.content} />
          )}

          {/* Image artifacts */}
          {artifact.type === "image" && artifact.url && (
            <ImageDisplay url={artifact.url} alt={artifact.title} />
          )}

          {/* Fallback for document and unknown types */}
          {!["code", "chart", "table", "mermaid", "html", "image"].includes(artifact.type) && (
            <div className="p-3 text-sm text-text whitespace-pre-wrap">{artifact.content}</div>
          )}
        </div>
      )}
    </div>
  );
}
