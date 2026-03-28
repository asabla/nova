import { useState, useRef, useMemo, useCallback } from "react";
import {
  FileText,
  Link,
  RefreshCw,
  X,
  Trash2,
  FileUp,
  Globe,
  Type,
  Search,
  Plus,
  Eye,
  File,
  FileCode,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Badge } from "../ui/Badge";
import { Dialog } from "../ui/Dialog";
import { EmptyState } from "../ui/EmptyState";
import { Pagination } from "../ui/Pagination";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/Table";
import { toast } from "../ui/Toast";
import { Skeleton } from "../ui/Skeleton";
import { api, getActiveOrgId } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { formatRelativeTime } from "../../lib/format";
import { useDragDrop } from "../../hooks/useDragDrop";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";
import type { KnowledgeDocument } from "./types";

const PAGE_SIZE = 20;

function getFileIcon(doc: KnowledgeDocument) {
  if (doc.sourceUrl) return Globe;
  const ext = doc.title?.split(".").pop()?.toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "xls") return FileSpreadsheet;
  if (ext === "json" || ext === "md" || ext === "ts" || ext === "js") return FileCode;
  if (ext === "pdf") return File;
  return FileText;
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
  const [deleteDocTarget, setDeleteDocTarget] = useState<KnowledgeDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const { data: documentsData, isLoading: docsLoading, isError: docsError, refetch: refetchDocs } = useQuery({
    queryKey: [...queryKeys.knowledge.detail(collectionId), "documents"],
    queryFn: () => api.get<{ data: KnowledgeDocument[] }>(`/api/knowledge/${collectionId}/documents`),
  });

  const documents: KnowledgeDocument[] = (documentsData as any)?.data ?? [];

  // Client-side filter + pagination
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter((d) => d.title?.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showPagination = filtered.length > PAGE_SIZE;

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList | File[]) => {
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
      setDeleteDocTarget(null);
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(collectionId), "documents"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(collectionId) });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.documentDeleteFailed", { defaultValue: "Delete failed" })),
  });

  const handleFileDrop = useCallback(
    (files: File[]) => uploadMutation.mutate(files),
    [uploadMutation],
  );

  const { isDragging, dragHandlers } = useDragDrop(handleFileDrop);

  const handleFileSelect = () => fileInputRef.current?.click();

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

  // Hidden file input — always in DOM
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept=".pdf,.txt,.md,.csv,.json,.html,.docx,.doc,.xlsx,.xls,.pptx,.png,.jpg,.jpeg,.gif,.webp,.svg,.ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.kt,.swift,.c,.cpp,.h,.hpp,.cs,.php,.sh,.bash,.zsh,.sql,.yaml,.yml,.toml,.xml,.css,.scss"
      className="hidden"
      onChange={handleFilesChosen}
    />
  );

  return (
    <div className="space-y-4" {...dragHandlers}>
      {fileInput}

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-surface/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-primary bg-primary/5">
            <Upload className="h-10 w-10 text-primary" />
            <p className="text-sm font-medium text-text">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Documents table */}
      {docsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
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
        /* ── Empty state: drop zone with action buttons ── */
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-text">
            {t("knowledge.noDocuments", { defaultValue: "No documents yet" })}
          </h3>
          <p className="text-sm text-text-secondary max-w-sm mt-1">
            {t("knowledge.noDocumentsDesc", { defaultValue: "Drag and drop files here, or use the options below." })}
          </p>
          <div className="flex items-center gap-2 mt-5">
            <Button variant="primary" size="sm" onClick={handleFileSelect}>
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
              {t("knowledge.uploadFiles", { defaultValue: "Upload Files" })}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setShowUrlInput(true); setShowContentInput(false); }}>
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              {t("knowledge.addUrl", { defaultValue: "Add URL" })}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setShowContentInput(true); setShowUrlInput(false); }}>
              <Type className="h-3.5 w-3.5" aria-hidden="true" />
              {t("knowledge.pasteContent", { defaultValue: "Paste Content" })}
            </Button>
          </div>
        </div>
      ) : (
        /* ── Populated state: action bar + table ── */
        <>
          {/* Actions bar */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddMenu(!showAddMenu)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t("knowledge.addContent", { defaultValue: "Add" })}
              </Button>
              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-lg border border-border bg-surface shadow-lg py-1">
                    <button
                      onClick={() => { handleFileSelect(); setShowAddMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text hover:bg-surface-secondary"
                    >
                      <FileUp className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                      {uploadMutation.isPending ? t("knowledge.uploading", { defaultValue: "Uploading..." }) : t("knowledge.uploadFiles", { defaultValue: "Upload Files" })}
                    </button>
                    <button
                      onClick={() => { setShowUrlInput(true); setShowContentInput(false); setShowAddMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text hover:bg-surface-secondary"
                    >
                      <Globe className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                      {t("knowledge.addUrl", { defaultValue: "Add URL" })}
                    </button>
                    <button
                      onClick={() => { setShowContentInput(true); setShowUrlInput(false); setShowAddMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text hover:bg-surface-secondary"
                    >
                      <Type className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                      {t("knowledge.pasteContent", { defaultValue: "Paste Content" })}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Search */}
            <div className="flex-1 max-w-xs relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary z-10" aria-hidden="true" />
              <Input
                type="text"
                placeholder={t("knowledge.searchDocuments", { defaultValue: "Search documents..." })}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="h-8 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-7 w-7" />}
              title={t("knowledge.noMatchingDocs", { defaultValue: "No matching documents" })}
              description={t("knowledge.noMatchingDocsDesc", { defaultValue: "Try a different search term." })}
            />
          ) : (
            <>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-surface-tertiary/50">
                      <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">{t("knowledge.name", { defaultValue: "Name" })}</TableHead>
                      <TableHead className="px-4 py-2.5 text-center text-xs font-medium text-text-tertiary">{t("knowledge.statusLabel", { defaultValue: "Status" })}</TableHead>
                      <TableHead className="px-4 py-2.5 text-center text-xs font-medium text-text-tertiary">{t("knowledge.chunks", { defaultValue: "Chunks" })}</TableHead>
                      <TableHead className="px-4 py-2.5 text-right text-xs font-medium text-text-tertiary">{t("knowledge.added", { defaultValue: "Added" })}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {paginated.map((doc) => {
                      const Icon = getFileIcon(doc);
                      return (
                        <TableRow
                          key={doc.id}
                          className="cursor-pointer group"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          <TableCell className="px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
                              <span className="text-text font-medium truncate">{doc.title ?? t("knowledge.untitled", { defaultValue: "Untitled" })}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-center">
                            <Badge
                              variant={
                                doc.status === "ready" ? "success"
                                  : doc.status === "indexing" ? "warning"
                                    : doc.status === "error" ? "danger"
                                      : "default"
                              }
                            >
                              {doc.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-center text-text-secondary">
                            {(doc.chunkCount ?? 0) > 0 ? doc.chunkCount : "\u2014"}
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-right text-text-tertiary">
                            {formatRelativeTime(doc.createdAt)}
                          </TableCell>
                          <TableCell className="px-2 py-2.5">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }}
                                className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-text transition-colors"
                                aria-label={t("knowledge.previewDocument", { defaultValue: "Preview document" })}
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteDocTarget(doc); }}
                                className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-danger transition-colors"
                                aria-label={t("knowledge.removeDocument", { defaultValue: "Remove document" })}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {showPagination && (
                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={filtered.length}
                  pageSize={PAGE_SIZE}
                  showInfo
                />
              )}
            </>
          )}
        </>
      )}

      {/* Add URL Dialog */}
      <Dialog
        open={showUrlInput}
        onClose={() => { setShowUrlInput(false); setUrlValue(""); }}
        title={t("knowledge.addUrlTitle", { defaultValue: "Add URL" })}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t("knowledge.addUrlDesc", { defaultValue: "Enter a URL to fetch and index its content." })}
          </p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface">
            <Link className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://example.com/document.pdf"
              className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-text-tertiary"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUrlSubmit();
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowUrlInput(false); setUrlValue(""); }}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button variant="primary" onClick={handleUrlSubmit} disabled={addUrlMutation.isPending || !urlValue.trim()}>
              {addUrlMutation.isPending ? t("knowledge.adding", { defaultValue: "Adding..." }) : t("knowledge.add", { defaultValue: "Add" })}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Paste Content Dialog */}
      <Dialog
        open={showContentInput}
        onClose={() => { setShowContentInput(false); setContentTitle(""); setContentValue(""); }}
        title={t("knowledge.pasteContentTitle", { defaultValue: "Paste Content" })}
      >
        <div className="space-y-4">
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowContentInput(false); setContentTitle(""); setContentValue(""); }}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="primary"
              onClick={handleContentSubmit}
              disabled={addContentMutation.isPending || !contentTitle.trim() || !contentValue.trim()}
            >
              {addContentMutation.isPending ? t("knowledge.adding", { defaultValue: "Adding..." }) : t("knowledge.addDocument", { defaultValue: "Add Document" })}
            </Button>
          </div>
        </div>
      </Dialog>

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

      {/* Document Preview Dialog */}
      <DocumentPreviewDialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        collectionId={collectionId}
        document={previewDoc}
      />
    </div>
  );
}
