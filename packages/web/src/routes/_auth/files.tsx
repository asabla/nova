import { useState, useEffect, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { formatDateTime } from "../../lib/format";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Trash2,
  Download,
  Search,
  HardDrive,
  RefreshCw,
  Image,
  FileCode,
  FileAudio,
  FileVideo,
  File,
  BookOpen,
  User,
  Link,
  ExternalLink,
  CheckSquare,
  ArrowUpDown,
} from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { Pagination } from "../../components/ui/Pagination";
import { Checkbox } from "../../components/ui/Checkbox";
import { CodeBlock } from "../../components/markdown/CodeBlock";
import { usePresignedUrl } from "../../hooks/usePresignedUrl";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";

export const Route = createFileRoute("/_auth/files")({
  component: FilesPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(contentType: string) {
  if (contentType === "link") return Link;
  if (contentType === "document") return FileText;
  if (contentType.startsWith("image/")) return Image;
  if (contentType.startsWith("audio/")) return FileAudio;
  if (contentType.startsWith("video/")) return FileVideo;
  if (
    contentType.includes("javascript") ||
    contentType.includes("typescript") ||
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("html") ||
    contentType.includes("css")
  )
    return FileCode;
  if (contentType.includes("pdf") || contentType.includes("text")) return FileText;
  return File;
}

function getSourceIcon(source: string) {
  switch (source) {
    case "knowledge":
      return BookOpen;
    default:
      return User;
  }
}

function getSourceColor(source: string) {
  switch (source) {
    case "knowledge":
      return "text-amber-500";
    default:
      return "text-text-tertiary";
  }
}

// ---------------------------------------------------------------------------
// Preview classification (mirrors AttachmentPreview)
// ---------------------------------------------------------------------------

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp"]);
const HTML_TYPES = new Set(["text/html"]);
const PDF_TYPES = new Set(["application/pdf"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/ogg"]);
const CSV_TYPES = new Set(["text/csv"]);
const TEXT_TYPES = new Set(["text/plain", "application/json", "application/xml"]);

type PreviewCategory = "image" | "html" | "pdf" | "video" | "audio" | "csv" | "text" | "download";

function classifyPreview(contentType: string | null | undefined): PreviewCategory {
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

function useFileContent(url: string | undefined, enabled: boolean) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !url) return;
    let cancelled = false;
    setLoading(true);
    setContent(null);
    setError(false);
    fetch(url)
      .then((r) => r.text())
      .then((text) => { if (!cancelled) { setContent(text); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [url, enabled]);

  return { content, loading, error };
}

// ---------------------------------------------------------------------------
// SortableCSVTable (from AttachmentPreview)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FilePreviewDialog
// ---------------------------------------------------------------------------

function FilePreviewDialog({
  file,
  onClose,
  onDownload,
  onDelete,
}: {
  file: any;
  onClose: () => void;
  onDownload: (file: any) => void;
  onDelete: (file: any) => void;
}) {
  const { t } = useTranslation();
  const isLink = file.contentType === "link";
  const category = isLink ? ("download" as PreviewCategory) : classifyPreview(file.contentType);
  const effectiveFileId = file.source === "knowledge" ? file.fileId : file.id;
  const needsUrl = !isLink && !!effectiveFileId;

  const { data: url, isLoading: urlLoading } = usePresignedUrl(effectiveFileId, needsUrl);

  const needsContent = (category === "csv" || category === "text" || category === "html") && !!url;
  const { content: fileContent, loading: contentLoading } = useFileContent(url, needsContent);

  const isLoading = (needsUrl && urlLoading) || (needsContent && contentLoading);

  const dialogSize: "sm" | "md" | "lg" | "full" =
    category === "audio" ? "md"
    : category === "download" ? "sm"
    : "full";

  const canDelete = file.source === "personal" || file.source === "knowledge";

  return (
    <Dialog open onClose={onClose} title={file.filename} size={dialogSize}>
      <div className="flex flex-col gap-4">
        {/* Metadata bar */}
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          {file.sizeBytes > 0 && <span>{formatBytes(file.sizeBytes)}</span>}
          {!isLink && file.contentType !== "document" && (
            <Badge variant="default">{(file.contentType ?? "unknown").split("/").pop()}</Badge>
          )}
          {isLink && <Badge variant="default">link</Badge>}
          <span>{formatDateTime(file.createdAt)}</span>
        </div>

        {/* Preview content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-pulse rounded-lg bg-surface-secondary border border-border h-48 w-full" />
          </div>
        ) : (
          <PreviewContent
            category={category}
            url={url}
            fileContent={fileContent}
            file={file}
          />
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          {isLink && file.sourceUrl ? (
            <Button variant="secondary" size="sm" onClick={() => window.open(file.sourceUrl, "_blank")}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t("files.openLink", { defaultValue: "Open link" })}
            </Button>
          ) : effectiveFileId ? (
            <Button variant="secondary" size="sm" onClick={() => onDownload(file)}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("files.download", { defaultValue: "Download" })}
            </Button>
          ) : null}
          {canDelete && (
            <Button variant="danger" size="sm" onClick={() => { onClose(); onDelete(file); }}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("common.delete", { defaultValue: "Delete" })}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function PreviewContent({
  category,
  url,
  fileContent,
  file,
}: {
  category: PreviewCategory;
  url: string | undefined;
  fileContent: string | null;
  file: any;
}) {
  switch (category) {
    case "image":
      return url ? (
        <div className="flex items-center justify-center">
          <img
            src={url}
            alt={file.filename}
            className="max-h-[70vh] max-w-full rounded-lg object-contain"
          />
        </div>
      ) : null;

    case "pdf":
      return url ? (
        <iframe src={url} className="w-full h-[70vh] rounded-lg border border-border" title={file.filename} />
      ) : null;

    case "html":
      return fileContent ? (
        <iframe
          srcDoc={fileContent}
          sandbox="allow-scripts"
          className="w-full h-[70vh] rounded-lg border border-border bg-white"
          title={file.filename}
        />
      ) : null;

    case "video":
      return url ? (
        <video src={url} controls preload="metadata" className="max-h-[70vh] w-full rounded-lg" />
      ) : null;

    case "audio":
      return url ? (
        <audio src={url} controls preload="metadata" className="w-full" />
      ) : null;

    case "csv":
      return fileContent ? (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
          <SortableCSVTable csv={fileContent} />
        </div>
      ) : null;

    case "text": {
      const language = extensionToLanguage(file.filename) ||
        (file.contentType === "application/json" ? "json" :
         file.contentType === "application/xml" ? "xml" : "text");
      return fileContent ? (
        <div className="max-h-[70vh] overflow-auto">
          <CodeBlock code={fileContent} language={language} />
        </div>
      ) : null;
    }

    default: {
      const isLink = file.contentType === "link";
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-surface-secondary flex items-center justify-center mb-4">
            {isLink ? (
              <Link className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
            ) : (
              <File className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
            )}
          </div>
          <p className="text-sm text-text-secondary">
            {isLink
              ? file.sourceUrl ?? "No URL available"
              : "No preview available for this file type"}
          </p>
        </div>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// FilesPage
// ---------------------------------------------------------------------------

type SourceFilter = "all" | "personal" | "knowledge";

function FilesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; filename: string; source: string;  } | null>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const pageSize = 20;

  // Debounce search
  const searchTimeoutRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef[0]) clearTimeout(searchTimeoutRef[0]);
    searchTimeoutRef[0] = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const {
    data: filesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.files.list(), "all", { page, search: debouncedSearch, source: sourceFilter }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      return api.get<any>(`/api/files/all?${params}`);
    },
  });

  const { data: usageData } = useQuery({
    queryKey: [...queryKeys.files.all, "usage"],
    queryFn: () => api.get<any>("/api/files/usage/me"),
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (target: { id: string; source: string;  }) => {
      if (target.source === "knowledge") {
        return api.delete(`/api/knowledge/documents/${target.id}`);
      }
      return api.delete(`/api/files/${target.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
      setDeleteTarget(null);
      toast(t("files.deleted", { defaultValue: "File deleted" }), "success");
    },
    onError: () => {
      toast(t("errors.generic", { defaultValue: "Something went wrong" }), "error");
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (file: any) => {
      if (file.source === "knowledge" && file.sourceUrl) {
        window.open(file.sourceUrl, "_blank");
        return;
      }
      if (file.source === "knowledge" && file.fileId) {
        const result = await api.get<{ url: string }>(`/api/files/${file.fileId}/download`);
        window.open(result.url, "_blank");
        return;
      }
      const result = await api.get<{ url: string }>(`/api/files/${file.id}/download`);
      window.open(result.url, "_blank");
    },
    onError: () => {
      toast(t("errors.generic", { defaultValue: "Something went wrong" }), "error");
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (files: Array<{ id: string; source: string }>) =>
      Promise.all(
        files.map((f) =>
          f.source === "knowledge"
            ? api.delete(`/api/knowledge/documents/${f.id}`)
            : api.delete(`/api/files/${f.id}`)
        )
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
      setSelected(new Set());
      setBulkMode(false);
      setShowBulkDeleteConfirm(false);
      toast(t("files.bulkDeleted", { defaultValue: "Files deleted" }), "success");
    },
    onError: () => {
      toast(t("errors.generic", { defaultValue: "Something went wrong" }), "error");
    },
  });

  const allFiles = (filesData as any)?.data ?? [];
  const total = (filesData as any)?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const usage = usageData as any;

  // Bulk selection helpers
  const fileKey = (file: any) => `${file.source}-${file.id}`;

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allOnPageSelected = allFiles.length > 0 && allFiles.every((f: any) => selected.has(fileKey(f)));
  const someSelected = allFiles.some((f: any) => selected.has(fileKey(f)));

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelected((prev) => {
        const next = new Set(prev);
        allFiles.forEach((f: any) => next.add(fileKey(f)));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        allFiles.forEach((f: any) => next.delete(fileKey(f)));
        return next;
      });
    }
  }, [allFiles]);

  const handleBulkDownload = useCallback(async () => {
    const selectedFiles = allFiles.filter((f: any) => selected.has(fileKey(f)));
    let count = 0;
    for (const file of selectedFiles) {
      if (file.contentType === "link" && file.sourceUrl) {
        window.open(file.sourceUrl, "_blank");
        count++;
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }
      const fid = file.source === "knowledge" && file.fileId ? file.fileId : file.id;
      if (!fid || file.contentType === "link") continue;
      try {
        const result = await api.get<{ url: string }>(`/api/files/${fid}/download`);
        window.open(result.url, "_blank");
        count++;
        await new Promise((r) => setTimeout(r, 150));
      } catch { /* skip failures */ }
    }
    if (count > 0) toast(t("files.bulkDownloaded", { defaultValue: "Downloads started" }), "success");
  }, [allFiles, selected, t]);

  const handleToggleBulkMode = useCallback(() => {
    setBulkMode((prev) => {
      if (prev) setSelected(new Set());
      return !prev;
    });
  }, []);

  const selectedFilesForDelete = useMemo(() => {
    return allFiles.filter((f: any) => selected.has(fileKey(f)));
  }, [allFiles, selected]);

  const sourceFilterOptions: { key: SourceFilter; label: string }[] = [
    { key: "all", label: t("files.filterAll", { defaultValue: "All Sources" }) },
    { key: "personal", label: t("files.filterPersonal", { defaultValue: "My Files" }) },
    { key: "knowledge", label: t("files.filterKnowledge", { defaultValue: "Knowledge" }) },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">
              {t("files.title", { defaultValue: "Files" })}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {t("files.subtitle", { defaultValue: "All files across conversations and knowledge collections" })}
            </p>
          </div>
          {usage && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
              <span>{usage.totalMb ?? 0} MB used</span>
            </div>
          )}
        </div>

        {/* Search + Bulk toggle */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 input-glow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("files.searchPlaceholder", { defaultValue: "Search files..." })}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-tertiary"
              aria-label={t("files.searchPlaceholder", { defaultValue: "Search files..." })}
            />
          </div>
          <button
            onClick={handleToggleBulkMode}
            className={`p-2.5 rounded-lg border transition-colors ${
              bulkMode
                ? "bg-primary/10 border-primary text-primary"
                : "border-border text-text-tertiary hover:text-text hover:bg-surface-secondary"
            }`}
            aria-label={t("files.bulkSelect", { defaultValue: "Bulk select" })}
            title={t("files.bulkSelect", { defaultValue: "Bulk select" })}
          >
            <CheckSquare className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Source filter tabs */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-1 p-1 rounded-lg bg-surface-secondary border border-border w-fit">
            {sourceFilterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => { setSourceFilter(opt.key); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sourceFilter === opt.key
                    ? "bg-surface text-text shadow-sm"
                    : "text-text-tertiary hover:text-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action bar */}
        {bulkMode && selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 mb-4 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm font-medium text-text">
              {selected.size} {t("files.selected", { defaultValue: "selected" })}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleBulkDownload}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t("files.download", { defaultValue: "Download" })}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setShowBulkDeleteConfirm(true)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("common.delete", { defaultValue: "Delete" })}
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-danger mb-4">
              {t("files.loadError", { defaultValue: "Failed to load files." })}
            </p>
            <Button variant="secondary" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("common.retry", { defaultValue: "Retry" })}
            </Button>
          </div>
        ) : allFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <HardDrive className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">
              {t("files.emptyTitle", { defaultValue: "No files yet" })}
            </h2>
            <p className="text-sm text-text-secondary max-w-sm">
              {t("files.emptyDescription", {
                defaultValue: "Files you upload in conversations or knowledge collections will appear here.",
              })}
            </p>
          </div>
        ) : (
          <>
            {/* File list */}
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              {/* Select all row */}
              {bulkMode && (
                <div className="flex items-center gap-3 px-4 py-2 bg-surface-tertiary">
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={someSelected && !allOnPageSelected}
                    onChange={handleSelectAll}
                  />
                  <span className="text-xs text-text-tertiary">
                    {t("files.selectAll", { defaultValue: "Select all on this page" })}
                  </span>
                </div>
              )}

              {allFiles.map((file: any) => {
                const Icon = getFileIcon(file.contentType ?? "");
                const SourceIcon = getSourceIcon(file.source);
                const sourceColor = getSourceColor(file.source);
                const isLink = file.contentType === "link";
                const canDownload = !isLink || file.sourceUrl;
                const canDelete = file.source === "personal" || file.source === "knowledge";
                const key = fileKey(file);
                const isSelected = selected.has(key);

                return (
                  <div
                    key={key}
                    onClick={() => {
                      if (bulkMode) {
                        toggleSelect(key);
                      } else {
                        setPreviewFile(file);
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary/5"
                        : "bg-surface-secondary hover:bg-surface-tertiary"
                    }`}
                  >
                    {bulkMode && (
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleSelect(key)}
                        />
                      </div>
                    )}
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{file.filename}</p>
                      <div className="flex items-center gap-2 text-[11px] text-text-tertiary mt-0.5">
                        {file.sizeBytes > 0 && (
                          <>
                            <span>{formatBytes(file.sizeBytes)}</span>
                            <span aria-hidden="true">&middot;</span>
                          </>
                        )}
                        {!isLink && file.contentType !== "document" && (
                          <>
                            <Badge variant="default">{(file.contentType ?? "unknown").split("/").pop()}</Badge>
                            <span aria-hidden="true">&middot;</span>
                          </>
                        )}
                        {isLink && (
                          <>
                            <Badge variant="default">link</Badge>
                            <span aria-hidden="true">&middot;</span>
                          </>
                        )}
                        <span>{formatDateTime(file.createdAt)}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span className={`flex items-center gap-1 ${sourceColor}`}>
                          <SourceIcon className="h-3 w-3" aria-hidden="true" />
                          {file.sourceName ?? file.source}
                        </span>
                      </div>
                    </div>
                    {!bulkMode && (
                      <div className="flex items-center gap-1 shrink-0">
                        {canDownload && (
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadMutation.mutate(file); }}
                            disabled={downloadMutation.isPending}
                            className="p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface transition-colors"
                            aria-label={isLink ? "Open link" : t("files.download", { defaultValue: "Download" })}
                            title={isLink ? "Open link" : t("files.download", { defaultValue: "Download" })}
                          >
                            {isLink ? (
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Download className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: file.id, filename: file.filename, source: file.source }); }}
                            className="p-2 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/5 transition-colors"
                            aria-label={t("files.delete", { defaultValue: "Delete" })}
                            title={t("files.delete", { defaultValue: "Delete" })}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                showInfo
                totalItems={total}
                pageSize={pageSize}
                className="mt-4"
              />
            )}
          </>
        )}
      </div>

      {/* File preview dialog */}
      {previewFile && (
        <FilePreviewDialog
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={(file) => downloadMutation.mutate(file)}
          onDelete={(file) => {
            setPreviewFile(null);
            setDeleteTarget({ id: file.id, filename: file.filename, source: file.source });
          }}
        />
      )}

      {/* Single delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("files.deleteConfirmTitle", { defaultValue: "Delete file" })}
        size="sm"
      >
        <p className="text-sm text-text-secondary mb-4">
          {t("files.deleteConfirmMessage", {
            defaultValue: `Are you sure you want to delete "${deleteTarget?.filename}"? This cannot be undone.`,
          })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteMutation.isPending}
            onClick={() => {
              if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id, source: deleteTarget.source });
            }}
          >
            {t("common.delete", { defaultValue: "Delete" })}
          </Button>
        </div>
      </Dialog>

      {/* Bulk delete confirmation dialog */}
      <Dialog
        open={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        title={t("files.bulkDeleteTitle", { defaultValue: "Delete files" })}
        size="sm"
      >
        <p className="text-sm text-text-secondary mb-4">
          {t("files.bulkDeleteMessage", {
            defaultValue: `Are you sure you want to delete ${selected.size} file(s)? This cannot be undone.`,
          })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowBulkDeleteConfirm(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={bulkDeleteMutation.isPending}
            onClick={() => {
              bulkDeleteMutation.mutate(
                selectedFilesForDelete.map((f: any) => ({ id: f.id, source: f.source }))
              );
            }}
          >
            {t("files.bulkDeleteConfirm", { defaultValue: `Delete ${selected.size} file(s)` })}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
