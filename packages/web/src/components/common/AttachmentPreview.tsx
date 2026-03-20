import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Download, Maximize2, FileText, Paperclip, X, ArrowUpDown } from "lucide-react";
import { clsx } from "clsx";
import { usePresignedUrl } from "../../hooks/usePresignedUrl";
import { CodeBlock } from "../markdown/CodeBlock";
import { Dialog } from "../ui/Dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/Table";

interface Attachment {
  id: string;
  fileId?: string | null;
  filename?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  attachmentType: string;
}

interface AttachmentPreviewProps {
  attachment: Attachment;
}

// --- File type classification ---

const IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp",
]);
const HTML_TYPES = new Set(["text/html"]);
const PDF_TYPES = new Set(["application/pdf"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/ogg"]);
const CSV_TYPES = new Set(["text/csv"]);
const TEXT_TYPES = new Set(["text/plain", "application/json", "application/xml"]);

type PreviewCategory = "image" | "html" | "pdf" | "video" | "audio" | "csv" | "text" | "download";

function classify(contentType: string | null | undefined): PreviewCategory {
  if (!contentType) return "download";
  if (IMAGE_TYPES.has(contentType)) return "image";
  if (HTML_TYPES.has(contentType)) return "html";
  if (PDF_TYPES.has(contentType)) return "pdf";
  if (VIDEO_TYPES.has(contentType)) return "video";
  if (AUDIO_TYPES.has(contentType)) return "audio";
  if (CSV_TYPES.has(contentType)) return "csv";
  if (TEXT_TYPES.has(contentType)) return "text";
  return "download";
}

function formatSize(bytes: number | null | undefined): string | null {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionToLanguage(filename: string | null | undefined): string {
  if (!filename) return "text";
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    json: "json", xml: "xml", py: "python", js: "javascript",
    ts: "typescript", html: "html", css: "css", sql: "sql",
    sh: "bash", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", txt: "text",
  };
  return map[ext ?? ""] ?? "text";
}

// --- Lazy loading hook via IntersectionObserver ---

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

// --- Content fetching hook (for CSV / text files) ---

function useFileContent(url: string | undefined, enabled: boolean) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !url) return;
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then((r) => r.text())
      .then((text) => { if (!cancelled) { setContent(text); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [url, enabled]);

  return { content, loading, error };
}

// --- CSV Table (extracted from ArtifactRenderer pattern) ---

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
      if (!isNaN(numA) && !isNaN(numB)) return sortAsc ? numA - numB : numB - numA;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [body, sortCol, sortAsc]);

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) setSortAsc(!sortAsc);
    else { setSortCol(colIndex); setSortAsc(true); }
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

// --- Skeleton placeholder ---

function PreviewSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-pulse rounded-lg bg-surface-secondary border border-border", className)} />
  );
}

// --- Download button (fallback / default) ---

function DownloadButton({ attachment, onClick }: { attachment: Attachment; onClick: () => void }) {
  const sizeLabel = formatSize(attachment.sizeBytes);
  const isImage = attachment.contentType?.startsWith("image/");

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border hover:bg-surface-secondary transition-colors text-left max-w-[240px]"
    >
      {isImage ? (
        <Paperclip className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
      ) : (
        <FileText className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text truncate">{attachment.filename ?? "Attachment"}</p>
        {sizeLabel && <p className="text-[10px] text-text-tertiary">{sizeLabel}</p>}
      </div>
      <Download className="h-3.5 w-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
    </button>
  );
}

// --- Toolbar for iframe-based previews ---

function PreviewToolbar({ filename, onExpand }: { filename: string; onExpand: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-surface-tertiary border-b border-border rounded-t-lg">
      <span className="text-xs font-medium text-text truncate">{filename}</span>
      <button
        onClick={onExpand}
        className="text-text-tertiary hover:text-text p-1 rounded transition-colors"
        aria-label="Expand"
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// --- File label ---

function FileLabel({ filename, sizeBytes }: { filename: string; sizeBytes?: number | null }) {
  const sizeLabel = formatSize(sizeBytes);
  return (
    <p className="text-[10px] text-text-tertiary mt-1">
      {filename}
      {sizeLabel && <span className="ml-1">({sizeLabel})</span>}
    </p>
  );
}

// --- Main component ---

export function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const category = classify(attachment.contentType);
  const { ref, inView } = useInView();
  const { data: url, isLoading: urlLoading, isError: urlError } = usePresignedUrl(attachment.fileId, inView);
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const needsContent = category === "csv" || category === "text" || category === "html";
  const { content: fileContent, loading: contentLoading, error: contentError } = useFileContent(url, needsContent && !!url);

  const filename = attachment.filename ?? "Attachment";

  const handleDownload = useCallback(() => {
    if (url) window.open(url, "_blank");
  }, [url]);

  // Fallback: if URL fetch fails, show download button using API directly
  const handleDirectDownload = useCallback(async () => {
    if (!attachment.fileId) return;
    try {
      const { api } = await import("../../lib/api");
      const res = await api.get<{ url: string }>(`/api/files/${attachment.fileId}/download`);
      window.open((res as any).url, "_blank");
    } catch { /* ignore */ }
  }, [attachment.fileId]);

  if (urlError || (needsContent && contentError)) {
    return <div ref={ref}><DownloadButton attachment={attachment} onClick={handleDirectDownload} /></div>;
  }

  if (category === "download") {
    return <div ref={ref}><DownloadButton attachment={attachment} onClick={handleDirectDownload} /></div>;
  }

  // --- Image ---
  if (category === "image") {
    return (
      <div ref={ref}>
        {urlLoading || !url ? (
          <PreviewSkeleton className="h-[200px] w-[300px]" />
        ) : (
          <>
            <img
              src={url}
              alt={filename}
              className="max-h-[300px] rounded-lg cursor-pointer object-contain bg-surface-secondary border border-border"
              onClick={() => setLightboxOpen(true)}
            />
            <FileLabel filename={filename} sizeBytes={attachment.sizeBytes} />

            {/* Lightbox overlay */}
            {lightboxOpen && (
              <div
                className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
                onClick={() => setLightboxOpen(false)}
                onKeyDown={(e) => { if (e.key === "Escape") setLightboxOpen(false); }}
              >
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <img
                    src={url}
                    alt={filename}
                    className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button
                      onClick={handleDownload}
                      className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                      aria-label="Download"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => setLightboxOpen(false)}
                      className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // --- HTML ---
  if (category === "html") {
    return (
      <div ref={ref} className="w-full max-w-2xl">
        {urlLoading || contentLoading || !fileContent ? (
          <PreviewSkeleton className="h-[400px]" />
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <PreviewToolbar filename={filename} onExpand={() => setExpanded(true)} />
              <iframe
                srcDoc={fileContent}
                sandbox="allow-scripts"
                className="w-full h-[400px] bg-white"
                title={filename}
              />
            </div>
            <Dialog open={expanded} onClose={() => setExpanded(false)} title={filename} size="full">
              <iframe
                srcDoc={fileContent}
                sandbox="allow-scripts"
                className="w-full h-[70vh] rounded-lg border border-border bg-white"
                title={filename}
              />
            </Dialog>
          </>
        )}
      </div>
    );
  }

  // --- PDF ---
  if (category === "pdf") {
    return (
      <div ref={ref} className="w-full max-w-2xl">
        {urlLoading || !url ? (
          <PreviewSkeleton className="h-[400px]" />
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <PreviewToolbar filename={filename} onExpand={() => setExpanded(true)} />
              <iframe
                src={url}
                className="w-full h-[400px]"
                title={filename}
              />
            </div>
            <Dialog open={expanded} onClose={() => setExpanded(false)} title={filename} size="full">
              <iframe
                src={url}
                className="w-full h-[70vh] rounded-lg border border-border"
                title={filename}
              />
            </Dialog>
          </>
        )}
      </div>
    );
  }

  // --- Video ---
  if (category === "video") {
    return (
      <div ref={ref}>
        {urlLoading || !url ? (
          <PreviewSkeleton className="h-[200px] w-[400px]" />
        ) : (
          <>
            <video
              src={url}
              controls
              preload="metadata"
              className="max-h-[300px] rounded-lg border border-border"
            />
            <FileLabel filename={filename} sizeBytes={attachment.sizeBytes} />
          </>
        )}
      </div>
    );
  }

  // --- Audio ---
  if (category === "audio") {
    return (
      <div ref={ref} className="w-full max-w-md">
        {urlLoading || !url ? (
          <PreviewSkeleton className="h-[54px]" />
        ) : (
          <>
            <FileLabel filename={filename} sizeBytes={attachment.sizeBytes} />
            <audio src={url} controls preload="metadata" className="w-full mt-1" />
          </>
        )}
      </div>
    );
  }

  // --- CSV ---
  if (category === "csv") {
    return (
      <div ref={ref} className="w-full max-w-2xl">
        {urlLoading || contentLoading || !fileContent ? (
          <PreviewSkeleton className="h-[200px]" />
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <PreviewToolbar filename={filename} onExpand={() => setExpanded(true)} />
              <div className="max-h-[300px] overflow-auto">
                <SortableCSVTable csv={fileContent} />
              </div>
            </div>
            <Dialog open={expanded} onClose={() => setExpanded(false)} title={filename} size="full">
              <div className="max-h-[70vh] overflow-auto">
                <SortableCSVTable csv={fileContent} />
              </div>
            </Dialog>
          </>
        )}
      </div>
    );
  }

  // --- Text/Code ---
  if (category === "text") {
    const language = extensionToLanguage(attachment.filename) ||
      (attachment.contentType === "application/json" ? "json" :
       attachment.contentType === "application/xml" ? "xml" : "text");

    return (
      <div ref={ref} className="w-full max-w-2xl">
        {urlLoading || contentLoading || !fileContent ? (
          <PreviewSkeleton className="h-[150px]" />
        ) : (
          <>
            <div className="max-h-[200px] overflow-auto">
              <CodeBlock code={fileContent} language={language} />
            </div>
            <FileLabel filename={filename} sizeBytes={attachment.sizeBytes} />
          </>
        )}
      </div>
    );
  }

  // Fallback
  return <div ref={ref}><DownloadButton attachment={attachment} onClick={handleDirectDownload} /></div>;
}
