import { useState } from "react";
import { Download, Maximize2, Minimize2, Save, FileText, Image, Code, BarChart } from "lucide-react";
import { clsx } from "clsx";

interface Artifact {
  id: string;
  type: "code" | "image" | "document" | "chart" | "audio" | "video";
  title: string;
  content: string;
  language?: string;
  mimeType?: string;
  url?: string;
}

interface ArtifactDisplayProps {
  artifact: Artifact;
  onSave?: (artifactId: string) => void;
}

const typeIcons = {
  code: Code,
  image: Image,
  document: FileText,
  chart: BarChart,
  audio: FileText,
  video: FileText,
};

export function ArtifactDisplay({ artifact, onSave }: ArtifactDisplayProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const Icon = typeIcons[artifact.type] ?? FileText;

  const handleDownload = () => {
    if (artifact.url) {
      window.open(artifact.url, "_blank");
      return;
    }
    const blob = new Blob([artifact.content], { type: artifact.mimeType ?? "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.title;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={clsx(
        "rounded-xl border border-border overflow-hidden bg-surface-secondary my-2",
        fullscreen && "fixed inset-4 z-50 shadow-2xl",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-tertiary/50">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-text">{artifact.title}</span>
          {artifact.language && (
            <span className="text-[10px] text-text-tertiary bg-surface px-1.5 py-0.5 rounded border border-border">
              {artifact.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onSave && (
            <button onClick={() => onSave(artifact.id)} className="text-text-tertiary hover:text-text-secondary p-1 rounded" title="Save to library">
              <Save className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={handleDownload} className="text-text-tertiary hover:text-text-secondary p-1 rounded" title="Download">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setFullscreen(!fullscreen)} className="text-text-tertiary hover:text-text-secondary p-1 rounded">
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className={clsx("overflow-auto", fullscreen ? "flex-1" : "max-h-[400px]")}>
        {artifact.type === "image" && artifact.url && (
          <img src={artifact.url} alt={artifact.title} className="w-full" />
        )}

        {artifact.type === "code" && (
          <pre className="p-3 text-xs font-mono text-text overflow-x-auto">
            <code>{artifact.content}</code>
          </pre>
        )}

        {artifact.type === "chart" && (
          <div className="p-4 flex items-center justify-center text-text-tertiary text-sm">
            Chart rendering (requires chart.js integration)
          </div>
        )}

        {(artifact.type === "document" || !["image", "code", "chart"].includes(artifact.type)) && (
          <div className="p-3 text-sm text-text whitespace-pre-wrap">{artifact.content}</div>
        )}
      </div>
    </div>
  );
}
