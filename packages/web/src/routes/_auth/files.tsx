import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  BookOpen,
  User,
  Link,
  ExternalLink,
} from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import { CardSkeleton } from "../../components/ui/Skeleton";

export const Route = createFileRoute("/_auth/files")({
  component: FilesPage,
});

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
    case "workspace":
      return FolderKanban;
    case "knowledge":
      return BookOpen;
    default:
      return User;
  }
}

function getSourceColor(source: string) {
  switch (source) {
    case "workspace":
      return "text-blue-500";
    case "knowledge":
      return "text-amber-500";
    default:
      return "text-text-tertiary";
  }
}

type SourceFilter = "all" | "personal" | "workspace" | "knowledge";

function FilesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; filename: string; source: string; workspaceId?: string } | null>(null);
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
    mutationFn: (target: { id: string; source: string; workspaceId?: string }) => {
      if (target.source === "knowledge") {
        return api.delete(`/api/knowledge/documents/${target.id}`);
      }
      // Personal and workspace files both go through /api/files/:id
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

  const allFiles = (filesData as any)?.data ?? [];
  const total = (filesData as any)?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const usage = usageData as any;

  const sourceFilterOptions: { key: SourceFilter; label: string }[] = [
    { key: "all", label: t("files.filterAll", { defaultValue: "All Sources" }) },
    { key: "personal", label: t("files.filterPersonal", { defaultValue: "My Files" }) },
    { key: "workspace", label: t("files.filterWorkspace", { defaultValue: "Workspaces" }) },
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
              {t("files.subtitle", { defaultValue: "All files across conversations, workspaces, and knowledge collections" })}
            </p>
          </div>
          {usage && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
              <span>{usage.totalMb ?? 0} MB used</span>
            </div>
          )}
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("files.searchPlaceholder", { defaultValue: "Search files..." })}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-primary focus-visible:border-primary"
              aria-label={t("files.searchPlaceholder", { defaultValue: "Search files..." })}
            />
          </div>
        </div>

        {/* Source filter tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg bg-surface-secondary border border-border w-fit">
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
                defaultValue: "Files you upload in conversations, workspaces, or knowledge collections will appear here.",
              })}
            </p>
          </div>
        ) : (
          <>
            {/* File list */}
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              {allFiles.map((file: any) => {
                const Icon = getFileIcon(file.contentType ?? "");
                const SourceIcon = getSourceIcon(file.source);
                const sourceColor = getSourceColor(file.source);
                const isLink = file.contentType === "link";
                const canDownload = !isLink || file.sourceUrl;
                const canDelete = file.source === "personal" || file.source === "knowledge" || file.source === "workspace";

                return (
                  <div
                    key={`${file.source}-${file.id}`}
                    className="flex items-center gap-3 px-4 py-3 bg-surface-secondary hover:bg-surface-tertiary transition-colors"
                  >
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
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span className={`flex items-center gap-1 ${sourceColor}`}>
                          <SourceIcon className="h-3 w-3" aria-hidden="true" />
                          {file.sourceName ?? file.source}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canDownload && (
                        <button
                          onClick={() => downloadMutation.mutate(file)}
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
                          onClick={() => setDeleteTarget({ id: file.id, filename: file.filename, source: file.source, workspaceId: file.workspaceId })}
                          className="p-2 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/5 transition-colors"
                          aria-label={t("files.delete", { defaultValue: "Delete" })}
                          title={t("files.delete", { defaultValue: "Delete" })}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-text-secondary">
                <span>
                  {t("files.showing", {
                    defaultValue: `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`,
                    from: (page - 1) * pageSize + 1,
                    to: Math.min(page * pageSize, total),
                    total,
                  })}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-surface-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-surface-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
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
              if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id, source: deleteTarget.source, workspaceId: deleteTarget.workspaceId });
            }}
          >
            {t("common.delete", { defaultValue: "Delete" })}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
