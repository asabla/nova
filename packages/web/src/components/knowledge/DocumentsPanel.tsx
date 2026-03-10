import { useState, useRef } from "react";
import {
  FileText,
  Link,
  RefreshCw,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileUp,
  Globe,
  Type,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Badge } from "../ui/Badge";
import { Dialog } from "../ui/Dialog";
import { toast } from "../ui/Toast";
import { Skeleton } from "../ui/Skeleton";
import { api, getActiveOrgId } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

interface KnowledgeDocument {
  id: string;
  title: string;
  sourceUrl?: string;
  fileId?: string;
  status: "pending" | "indexing" | "ready" | "error";
  errorMessage?: string;
  tokenCount?: number;
  chunkCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeChunk {
  id: string;
  knowledgeDocumentId: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface DocumentsPanelProps {
  collectionId: string;
}

export function DocumentsPanel({ collectionId }: DocumentsPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showContentInput, setShowContentInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [contentTitle, setContentTitle] = useState("");
  const [contentValue, setContentValue] = useState("");
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<KnowledgeDocument | null>(null);

  const { data: documentsData, isLoading: docsLoading, isError: docsError, refetch: refetchDocs } = useQuery({
    queryKey: [...queryKeys.knowledge.detail(collectionId), "documents"],
    queryFn: () => api.get<{ data: KnowledgeDocument[] }>(`/api/knowledge/${collectionId}/documents`),
  });

  const { data: chunksData } = useQuery({
    queryKey: [...queryKeys.knowledge.detail(collectionId), "chunks", expandedDocId],
    queryFn: () => api.get<{ data: KnowledgeChunk[] }>(`/api/knowledge/${collectionId}/documents/${expandedDocId}/chunks`),
    enabled: !!expandedDocId,
  });

  const documents: KnowledgeDocument[] = (documentsData as any)?.data ?? [];
  const chunks: KnowledgeChunk[] = (chunksData as any)?.data ?? [];

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const url = `${import.meta.env.VITE_API_URL ?? ""}/api/knowledge/${collectionId}/documents/upload`;
      const headers: Record<string, string> = {};
      const orgId = getActiveOrgId();
      if (orgId) headers["x-org-id"] = orgId;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({ title: "Upload failed" }));
        throw new Error(problem.title ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("knowledge.filesUploaded", { defaultValue: "Files uploaded successfully" }));
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(collectionId), "documents"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(collectionId) });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.uploadFailed", { defaultValue: "Upload failed" })),
  });

  const addUrlMutation = useMutation({
    mutationFn: (url: string) =>
      api.post(`/api/knowledge/${collectionId}/documents`, { title: url, sourceUrl: url }),
    onSuccess: () => {
      toast.success(t("knowledge.urlAdded", { defaultValue: "URL added successfully" }));
      setUrlValue("");
      setShowUrlInput(false);
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(collectionId), "documents"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(collectionId) });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.urlAddFailed", { defaultValue: "Failed to add URL" })),
  });

  const addContentMutation = useMutation({
    mutationFn: (data: { title: string; content: string }) =>
      api.post(`/api/knowledge/${collectionId}/documents`, { title: data.title, content: data.content }),
    onSuccess: () => {
      toast.success(t("knowledge.documentAdded", { defaultValue: "Document added successfully" }));
      setContentTitle("");
      setContentValue("");
      setShowContentInput(false);
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(collectionId), "documents"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(collectionId) });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.documentAddFailed", { defaultValue: "Failed to add document" })),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/api/knowledge/${collectionId}/documents/${docId}`),
    onSuccess: () => {
      toast.success(t("knowledge.documentRemoved", { defaultValue: "Document removed" }));
      setExpandedDocId(null);
      setDeleteDocTarget(null);
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(collectionId), "documents"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(collectionId) });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.documentDeleteFailed", { defaultValue: "Delete failed" })),
  });

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMutation.mutate(e.target.files);
      e.target.value = "";
    }
  };

  const handleUrlSubmit = () => {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast.error(t("knowledge.invalidUrl", { defaultValue: "Please enter a valid URL" }));
      return;
    }
    addUrlMutation.mutate(trimmed);
  };

  const handleContentSubmit = () => {
    const title = contentTitle.trim();
    const content = contentValue.trim();
    if (!title || !content) {
      toast.error(t("knowledge.titleContentRequired", { defaultValue: "Title and content are required" }));
      return;
    }
    addContentMutation.mutate({ title, content });
  };

  return (
    <div className="max-w-3xl space-y-4">
      {/* Actions bar */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json,.html,.docx,.doc,.xlsx,.xls"
          className="hidden"
          onChange={handleFilesChosen}
        />
        <Button variant="primary" size="sm" onClick={handleFileSelect} disabled={uploadMutation.isPending}>
          <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
          {uploadMutation.isPending ? t("knowledge.uploading", { defaultValue: "Uploading..." }) : t("knowledge.uploadFiles", { defaultValue: "Upload Files" })}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => { setShowUrlInput(!showUrlInput); setShowContentInput(false); }}>
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          {t("knowledge.addUrl", { defaultValue: "Add URL" })}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => { setShowContentInput(!showContentInput); setShowUrlInput(false); }}>
          <Type className="h-3.5 w-3.5" aria-hidden="true" />
          {t("knowledge.pasteContent", { defaultValue: "Paste Content" })}
        </Button>
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface input-glow">
            <Link className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://example.com/document.pdf"
              className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-text-tertiary"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUrlSubmit();
                if (e.key === "Escape") { setShowUrlInput(false); setUrlValue(""); }
              }}
              autoFocus
            />
          </div>
          <Button variant="primary" size="sm" onClick={handleUrlSubmit} disabled={addUrlMutation.isPending || !urlValue.trim()}>
            {addUrlMutation.isPending ? t("knowledge.adding", { defaultValue: "Adding..." }) : t("knowledge.add", { defaultValue: "Add" })}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowUrlInput(false); setUrlValue(""); }} aria-label={t("common.close", { defaultValue: "Close" })}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* Content paste input */}
      {showContentInput && (
        <div className="space-y-2 p-4 rounded-lg border border-border bg-surface">
          <Input
            type="text"
            value={contentTitle}
            onChange={(e) => setContentTitle(e.target.value)}
            placeholder={t("knowledge.documentTitle", { defaultValue: "Document title" })}
            autoFocus
          />
          <Textarea
            value={contentValue}
            onChange={(e) => setContentValue(e.target.value)}
            placeholder={t("knowledge.pasteContentPlaceholder", { defaultValue: "Paste document content here..." })}
            rows={6}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowContentInput(false); setContentTitle(""); setContentValue(""); }}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleContentSubmit}
              disabled={addContentMutation.isPending || !contentTitle.trim() || !contentValue.trim()}
            >
              {addContentMutation.isPending ? t("knowledge.adding", { defaultValue: "Adding..." }) : t("knowledge.addDocument", { defaultValue: "Add Document" })}
            </Button>
          </div>
        </div>
      )}

      {/* Documents list */}
      {docsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : docsError ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-danger mb-4">{t("knowledge.docsLoadError", { defaultValue: "Failed to load documents." })}</p>
          <Button variant="secondary" onClick={() => refetchDocs()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t("common.retry", { defaultValue: "Retry" })}
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-surface-secondary flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-text-tertiary" aria-hidden="true" />
          </div>
          <h3 className="text-base font-medium text-text mb-1">{t("knowledge.noDocuments", { defaultValue: "No documents yet" })}</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            {t("knowledge.noDocumentsDesc", { defaultValue: "Upload files, add URLs, or paste content to build this knowledge collection." })}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {documents.map((doc) => {
            const isExpanded = expandedDocId === doc.id;
            return (
              <div key={doc.id} className="rounded-lg border border-border bg-surface overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-secondary transition-colors group cursor-pointer"
                  onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button className="shrink-0 p-0.5" aria-label={isExpanded ? t("common.collapse", { defaultValue: "Collapse" }) : t("common.expand", { defaultValue: "Expand" })}>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                      )}
                    </button>
                    <div className="h-8 w-8 rounded-lg bg-surface-secondary flex items-center justify-center shrink-0">
                      {doc.sourceUrl ? (
                        <Globe className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                      ) : (
                        <FileText className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{doc.title ?? t("knowledge.untitled", { defaultValue: "Untitled" })}</p>
                      <div className="flex items-center gap-2 text-xs text-text-tertiary">
                        {doc.sourceUrl && (
                          <span className="truncate max-w-[200px]">{doc.sourceUrl}</span>
                        )}
                        <span>{doc.chunkCount ?? 0} {t("knowledge.chunks", { defaultValue: "chunks" })}</span>
                        {doc.tokenCount != null && <span>{doc.tokenCount} {t("knowledge.tokens", { defaultValue: "tokens" })}</span>}
                        <span>{formatRelativeTime(doc.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        doc.status === "ready"
                          ? "success"
                          : doc.status === "indexing"
                            ? "warning"
                            : doc.status === "error"
                              ? "danger"
                              : "default"
                      }
                    >
                      {doc.status}
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDocTarget(doc);
                      }}
                      className="p-1.5 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={t("knowledge.removeDocument", { defaultValue: "Remove document" })}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Expanded: show chunks */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 bg-surface-secondary/50">
                    {doc.errorMessage && (
                      <div className="mb-3 px-3 py-2 rounded bg-danger/5 text-xs text-danger">
                        {doc.errorMessage}
                      </div>
                    )}
                    {chunks.length === 0 ? (
                      <p className="text-sm text-text-tertiary py-4 text-center">
                        {doc.status === "pending" ? t("knowledge.pendingIndexing", { defaultValue: "Document is pending indexing." }) : t("knowledge.noChunks", { defaultValue: "No chunks found." })}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-auto">
                        {chunks.map((chunk) => (
                          <div key={chunk.id} className="rounded border border-border bg-surface px-3 py-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-mono text-text-tertiary">
                                {t("knowledge.chunkNumber", { defaultValue: "Chunk" })} #{chunk.chunkIndex}
                              </span>
                              {chunk.tokenCount != null && (
                                <span className="text-xs text-text-tertiary">{chunk.tokenCount} {t("knowledge.tokens", { defaultValue: "tokens" })}</span>
                              )}
                            </div>
                            <p className="text-sm text-text whitespace-pre-wrap line-clamp-4">
                              {chunk.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Document Dialog */}
      <Dialog open={!!deleteDocTarget} onClose={() => setDeleteDocTarget(null)} title={t("knowledge.removeDocumentTitle", { defaultValue: "Remove Document" })}>
        <p className="text-sm text-text-secondary mb-4">
          {t("knowledge.removeDocumentConfirm", { defaultValue: "Are you sure you want to remove \"{{name}}\" from this collection?", name: deleteDocTarget?.title ?? "" })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteDocTarget(null)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleteDocTarget) {
                deleteDocMutation.mutate(deleteDocTarget.id);
              }
            }}
            disabled={deleteDocMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {deleteDocMutation.isPending ? t("common.removing", { defaultValue: "Removing..." }) : t("common.remove", { defaultValue: "Remove" })}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
