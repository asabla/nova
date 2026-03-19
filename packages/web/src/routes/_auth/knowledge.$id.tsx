import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ArrowLeft,
  Trash2,
  FileText,
  RefreshCw,
  Search,
  Settings2,
  Activity,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Tabs } from "../../components/ui/Tabs";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { DocumentsPanel } from "../../components/knowledge/DocumentsPanel";
import { SearchTab } from "../../components/knowledge/SearchTab";
import { SettingsTab } from "../../components/knowledge/SettingsTab";
import { ActivityTab } from "../../components/knowledge/ActivityTab";
import { DocumentPreviewDialog } from "../../components/knowledge/DocumentPreviewDialog";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import type { KnowledgeCollection, KnowledgeDocument } from "../../components/knowledge/types";

export const Route = createFileRoute("/_auth/knowledge/$id")({
  component: KnowledgeDetailPage,
});

function KnowledgeDetailPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDeleteCollectionDialog, setShowDeleteCollectionDialog] = useState(false);
  const [previewDocFromSearch, setPreviewDocFromSearch] = useState<KnowledgeDocument | null>(null);

  const { data: collection, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.knowledge.detail(id),
    queryFn: () => api.get<KnowledgeCollection>(`/api/knowledge/${id}`),
  });

  const { data: documentsData } = useQuery({
    queryKey: [...queryKeys.knowledge.detail(id), "documents"],
    queryFn: () => api.get<{ data: KnowledgeDocument[] }>(`/api/knowledge/${id}/documents`),
  });

  const documents: KnowledgeDocument[] = (documentsData as any)?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/knowledge/${id}`),
    onSuccess: () => {
      toast.success(t("knowledge.deleted", { defaultValue: "Collection deleted" }));
      navigate({ to: "/knowledge" });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.deleteFailed", { defaultValue: "Delete failed" })),
  });

  const reindexMutation = useMutation({
    mutationFn: () => api.post(`/api/knowledge/${id}/reindex`),
    onSuccess: () => {
      toast.success(t("knowledge.reindexStarted", { defaultValue: "Re-indexing started" }));
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(id), "history"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.reindexFailed", { defaultValue: "Re-index failed" })),
  });

  const handleViewDocumentFromSearch = (documentId: string) => {
    const doc = documents.find((d) => d.id === documentId);
    if (doc) setPreviewDocFromSearch(doc);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full max-w-3xl rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-sm text-danger mb-4">{t("knowledge.loadError", { defaultValue: "Failed to load collection." })}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("common.retry", { defaultValue: "Retry" })}
        </Button>
      </div>
    );
  }

  const col = collection as KnowledgeCollection | undefined;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount ?? 0), 0);

  const tabs = [
    { id: "documents", label: t("knowledge.tabs.documents", { defaultValue: "Documents" }), icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" /> },
    { id: "search", label: t("knowledge.tabs.search", { defaultValue: "Search" }), icon: <Search className="h-3.5 w-3.5" aria-hidden="true" /> },
    { id: "settings", label: t("knowledge.tabs.settings", { defaultValue: "Settings" }), icon: <Settings2 className="h-3.5 w-3.5" aria-hidden="true" /> },
    { id: "activity", label: t("knowledge.tabs.activity", { defaultValue: "Activity" }), icon: <Activity className="h-3.5 w-3.5" aria-hidden="true" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/knowledge" })}
            className="p-1 hover:bg-surface-secondary rounded"
            aria-label={t("common.goBack", { defaultValue: "Go back" })}
          >
            <ArrowLeft className="h-5 w-5 text-text-secondary" aria-hidden="true" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text">{col?.name ?? t("knowledge.collection", { defaultValue: "Collection" })}</h1>
            <p className="text-sm text-text-secondary">
              {documents.length} {t("knowledge.documents", { defaultValue: "documents" })}, {totalChunks} {t("knowledge.chunks", { defaultValue: "chunks" })}
            </p>
          </div>
          {col?.status && (
            <Badge variant={col.status === "active" || col.status === "ready" ? "success" : col.status === "indexing" ? "warning" : "default"}>
              {col.status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reindexMutation.mutate()}
            disabled={reindexMutation.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reindexMutation.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
            {reindexMutation.isPending ? t("knowledge.reindexing", { defaultValue: "Re-indexing..." }) : t("knowledge.reindex", { defaultValue: "Re-index" })}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={() => setShowDeleteCollectionDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("common.delete", { defaultValue: "Delete" })}
          </Button>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="flex-1 overflow-auto px-6 pt-3">
        <Tabs tabs={tabs} defaultTab="documents">
          {(activeTab) => (
            <div className="py-2">
              {activeTab === "documents" && <DocumentsPanel collectionId={id} />}
              {activeTab === "search" && <SearchTab collectionId={id} onViewDocument={handleViewDocumentFromSearch} />}
              {activeTab === "settings" && col && (
                <SettingsTab
                  collectionId={id}
                  collection={col}
                  onDelete={() => setShowDeleteCollectionDialog(true)}
                />
              )}
              {activeTab === "activity" && (
                <ActivityTab
                  collectionId={id}
                  documents={documents}
                  totalChunks={totalChunks}
                  collectionStatus={col?.status ?? "unknown"}
                />
              )}
            </div>
          )}
        </Tabs>
      </div>

      {/* Delete Collection Dialog */}
      <Dialog open={showDeleteCollectionDialog} onClose={() => setShowDeleteCollectionDialog(false)} title={t("knowledge.deleteCollectionTitle", { defaultValue: "Delete Collection" })}>
        <p className="text-sm text-text-secondary mb-4">
          {t("knowledge.deleteCollectionConfirm", { defaultValue: "Are you sure you want to delete this collection and all its documents? This action cannot be undone." })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowDeleteCollectionDialog(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              deleteMutation.mutate();
              setShowDeleteCollectionDialog(false);
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {deleteMutation.isPending ? t("common.deleting", { defaultValue: "Deleting..." }) : t("common.delete", { defaultValue: "Delete" })}
          </Button>
        </div>
      </Dialog>

      {/* Document Preview from Search tab */}
      <DocumentPreviewDialog
        open={!!previewDocFromSearch}
        onClose={() => setPreviewDocFromSearch(null)}
        collectionId={id}
        document={previewDocFromSearch}
      />
    </div>
  );
}
