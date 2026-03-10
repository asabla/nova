import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ArrowLeft,
  Save,
  Trash2,
  FileText,
  RefreshCw,
  Search,
  Settings2,
  TestTube,
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  Layers,
  Zap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import { Skeleton } from "../../components/ui/Skeleton";
import { DocumentsPanel } from "../../components/knowledge/DocumentsPanel";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

export const Route = createFileRoute("/_auth/knowledge/$id")({
  component: KnowledgeDetailPage,
});

type TabId = "documents" | "settings" | "test" | "activity";

interface KnowledgeDocument {
  id: string;
  title: string;
  status: string;
  chunkCount?: number;
  tokenCount?: number;
  createdAt: string;
}

interface IndexingJob {
  id: string;
  type: "index" | "re-index" | "delete";
  status: "queued" | "running" | "completed" | "failed";
  documentCount: number;
  processedCount: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface RetrievedChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

interface KnowledgeCollection {
  id: string;
  name: string;
  description?: string;
  status: string;
  embeddingModelId?: string;
  embeddingModel?: string;
  chunkSize: number;
  chunkOverlap: number;
  version: number;
  lastIndexedAt?: string;
  createdAt: string;
  updatedAt: string;
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

function KnowledgeDetailPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>("documents");
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<RetrievedChunk[] | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showDeleteCollectionDialog, setShowDeleteCollectionDialog] = useState(false);

  const { data: collection, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.knowledge.detail(id),
    queryFn: () => api.get<KnowledgeCollection>(`/api/knowledge/${id}`),
  });

  const { data: documentsData } = useQuery({
    queryKey: [...queryKeys.knowledge.detail(id), "documents"],
    queryFn: () => api.get<{ data: KnowledgeDocument[] }>(`/api/knowledge/${id}/documents`),
  });

  const { data: embeddingModelsData } = useQuery({
    queryKey: [...queryKeys.knowledge.all, "embedding-models"],
    queryFn: () => api.get<{ data: { id: string; name: string }[] }>("/api/knowledge/models/embedding"),
  });

  const embeddingModels: { id: string; name: string }[] = (embeddingModelsData as any)?.data ?? [];

  const { data: activityData } = useQuery({
    queryKey: [...queryKeys.knowledge.detail(id), "activity"],
    queryFn: () => api.get<{ data: IndexingJob[] }>(`/api/knowledge/${id}/jobs`),
    enabled: activeTab === "activity",
  });

  const documents: KnowledgeDocument[] = (documentsData as any)?.data ?? [];
  const jobs: IndexingJob[] = (activityData as any)?.data ?? [];

  const [form, setForm] = useState({
    name: "",
    description: "",
    embeddingModel: "text-embedding-3-small",
    chunkSize: 512,
    chunkOverlap: 50,
  });

  useEffect(() => {
    if (collection) {
      const col = collection as KnowledgeCollection;
      setForm({
        name: col.name ?? "",
        description: col.description ?? "",
        embeddingModel: col.embeddingModel ?? "text-embedding-3-small",
        chunkSize: col.chunkSize ?? 512,
        chunkOverlap: col.chunkOverlap ?? 50,
      });
    }
  }, [collection]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const nameDescPromise = api.patch(`/api/knowledge/${id}`, {
        name: data.name,
        description: data.description,
      });
      const configPromise = api.patch(`/api/knowledge/${id}/config`, {
        embeddingModel: data.embeddingModel,
        chunkSize: data.chunkSize,
        chunkOverlap: data.chunkOverlap,
      });
      return Promise.all([nameDescPromise, configPromise]);
    },
    onSuccess: () => {
      toast.success(t("knowledge.updated", { defaultValue: "Collection updated" }));
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list() });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.updateFailed", { defaultValue: "Update failed" })),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/knowledge/${id}`),
    onSuccess: () => {
      toast.success(t("knowledge.deleted", { defaultValue: "Collection deleted" }));
      // Navigate away first, then invalidate to avoid refetching deleted collection data
      navigate({ to: "/knowledge" });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.deleteFailed", { defaultValue: "Delete failed" })),
  });

  const reindexMutation = useMutation({
    mutationFn: () => api.post(`/api/knowledge/${id}/reindex`),
    onSuccess: () => {
      toast.success(t("knowledge.reindexStarted", { defaultValue: "Re-indexing started" }));
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(id), "activity"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.reindexFailed", { defaultValue: "Re-index failed" })),
  });

  const handleTest = async () => {
    if (!testQuery.trim()) return;
    setTestLoading(true);
    setTestResults(null);
    try {
      const result = await api.post<{ data: RetrievedChunk[] }>(`/api/knowledge/${id}/query`, {
        query: testQuery,
        topK: 5,
      });
      setTestResults((result as any)?.data ?? []);
    } catch (err: any) {
      toast.error(err.message ?? t("knowledge.queryFailed", { defaultValue: "Query failed" }));
    } finally {
      setTestLoading(false);
    }
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

  const tabs = [
    { id: "documents" as const, label: t("knowledge.tabs.documents", { defaultValue: "Documents" }), icon: FileText },
    { id: "test" as const, label: t("knowledge.tabs.queryTest", { defaultValue: "Query Test" }), icon: TestTube },
    { id: "settings" as const, label: t("knowledge.tabs.settings", { defaultValue: "Settings" }), icon: Settings2 },
    { id: "activity" as const, label: t("knowledge.tabs.activity", { defaultValue: "Activity" }), icon: Activity },
  ];

  const col = collection as KnowledgeCollection | undefined;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount ?? 0), 0);

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

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-text-secondary hover:text-text hover:bg-surface-secondary"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Documents Tab */}
        {activeTab === "documents" && (
          <DocumentsPanel collectionId={id} />
        )}

        {/* Query Test Tab */}
        {activeTab === "test" && (
          <div className="max-w-3xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                {t("knowledge.testQuery", { defaultValue: "Test Query" })}
              </label>
              <p className="text-xs text-text-secondary mb-3">
                {t("knowledge.testQueryDesc", { defaultValue: "Enter a natural language query to test retrieval against this collection. Results show the most relevant chunks with similarity scores." })}
              </p>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface input-glow">
                  <Search className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
                  <input
                    type="text"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder={t("knowledge.testQueryPlaceholder", { defaultValue: "What is the refund policy?" })}
                    className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-text-tertiary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTest();
                    }}
                  />
                </div>
                <Button variant="primary" onClick={handleTest} disabled={testLoading || !testQuery.trim()}>
                  <TestTube className="h-4 w-4" aria-hidden="true" />
                  {testLoading ? t("knowledge.searching", { defaultValue: "Searching..." }) : t("knowledge.search", { defaultValue: "Search" })}
                </Button>
              </div>
            </div>

            {/* Results */}
            {testResults !== null && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text">
                    {t("knowledge.retrievedChunks", { defaultValue: "Retrieved Chunks" })} ({testResults.length})
                  </h3>
                  {testResults.length > 0 && (
                    <span className="text-xs text-text-tertiary">{t("knowledge.sortedByRelevance", { defaultValue: "Sorted by relevance" })}</span>
                  )}
                </div>

                {testResults.length === 0 ? (
                  <div className="px-4 py-8 rounded-lg border border-border bg-surface text-center">
                    <Search className="h-8 w-8 text-text-tertiary mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-text-secondary">{t("knowledge.noResults", { defaultValue: "No relevant chunks found for this query." })}</p>
                    <p className="text-xs text-text-tertiary mt-1">
                      {t("knowledge.noResultsHint", { defaultValue: "Try a different query, or make sure documents have been indexed." })}
                    </p>
                  </div>
                ) : (
                  testResults.map((chunk, idx) => (
                    <div
                      key={chunk.id}
                      className="rounded-lg border border-border bg-surface overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-2 bg-surface-secondary border-b border-border">
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <span className="font-mono text-text-tertiary">#{idx + 1}</span>
                          <FileText className="h-3 w-3" aria-hidden="true" />
                          <span className="font-medium truncate max-w-[300px]">{chunk.documentName}</span>
                          <span className="text-text-tertiary">{t("knowledge.chunkLabel", { defaultValue: "chunk" })} {chunk.chunkIndex}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-warning" aria-hidden="true" />
                          <span
                            className={`text-xs font-mono font-semibold ${
                              chunk.score >= 0.8
                                ? "text-success"
                                : chunk.score >= 0.5
                                  ? "text-warning"
                                  : "text-text-tertiary"
                            }`}
                          >
                            {(chunk.score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                          {chunk.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-6">
            <Input
              label={t("knowledge.name", { defaultValue: "Name" })}
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <Textarea
              label={t("knowledge.description", { defaultValue: "Description" })}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("knowledge.descriptionPlaceholder", { defaultValue: "What kind of documents does this collection contain?" })}
              rows={3}
            />

            <div className="pt-2 border-t border-border">
              <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                {t("knowledge.embeddingConfig", { defaultValue: "Embedding Configuration" })}
              </h3>

              <div className="space-y-4">
                <Select
                  label={t("knowledge.embeddingModel", { defaultValue: "Embedding Model" })}
                  value={form.embeddingModel}
                  onChange={(value) => setForm({ ...form, embeddingModel: value })}
                  options={
                    embeddingModels.length === 0
                      ? [{ value: form.embeddingModel, label: form.embeddingModel }]
                      : embeddingModels.map((m) => ({ value: m.id, label: m.name }))
                  }
                  helperText={t("knowledge.embeddingModelHint", { defaultValue: "Changing the model will require a full re-index of all documents." })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t("knowledge.chunkSize", { defaultValue: "Chunk Size (tokens)" })}
                    type="number"
                    value={form.chunkSize}
                    onChange={(e) => setForm({ ...form, chunkSize: Math.max(64, parseInt(e.target.value) || 512) })}
                    min={64}
                    max={8192}
                    step={64}
                  />
                  <Input
                    label={t("knowledge.chunkOverlap", { defaultValue: "Chunk Overlap (tokens)" })}
                    type="number"
                    value={form.chunkOverlap}
                    onChange={(e) => setForm({ ...form, chunkOverlap: Math.max(0, parseInt(e.target.value) || 50) })}
                    min={0}
                    max={form.chunkSize / 2}
                    step={10}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="text-xs text-text-tertiary space-y-1">
                {col && (
                  <>
                    <p>{t("common.created", { defaultValue: "Created" })}: {new Date(col.createdAt).toLocaleDateString()}</p>
                    <p>{t("common.updated", { defaultValue: "Updated" })}: {new Date(col.updatedAt).toLocaleDateString()}</p>
                    {col.lastIndexedAt && <p>{t("knowledge.lastIndexed", { defaultValue: "Last indexed" })}: {new Date(col.lastIndexedAt).toLocaleDateString()}</p>}
                    <p>{t("knowledge.version", { defaultValue: "Version" })}: {col.version}</p>
                  </>
                )}
              </div>
              <Button
                variant="primary"
                onClick={() => updateMutation.mutate(form)}
                disabled={updateMutation.isPending}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {updateMutation.isPending ? t("common.saving", { defaultValue: "Saving..." }) : t("knowledge.saveSettings", { defaultValue: "Save Settings" })}
              </Button>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="max-w-3xl space-y-4">
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs text-text-tertiary mb-1">{t("knowledge.documents", { defaultValue: "Documents" })}</p>
                <p className="text-2xl font-semibold text-text">{documents.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs text-text-tertiary mb-1">{t("knowledge.totalChunks", { defaultValue: "Total Chunks" })}</p>
                <p className="text-2xl font-semibold text-text">{totalChunks}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs text-text-tertiary mb-1">{t("knowledge.status", { defaultValue: "Status" })}</p>
                <p className="text-2xl font-semibold text-text capitalize">{col?.status ?? t("common.unknown", { defaultValue: "unknown" })}</p>
              </div>
            </div>

            {/* Indexing status per document */}
            <div>
              <h3 className="text-sm font-medium text-text mb-3">{t("knowledge.docIndexingStatus", { defaultValue: "Document Indexing Status" })}</h3>
              {documents.length === 0 ? (
                <p className="text-sm text-text-tertiary">{t("knowledge.noDocsToIndex", { defaultValue: "No documents to index." })}</p>
              ) : (
                <div className="space-y-1">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded border border-border bg-surface">
                      <div className="flex items-center gap-2 min-w-0">
                        {doc.status === "ready" ? (
                          <CheckCircle className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                        ) : doc.status === "indexing" ? (
                          <RefreshCw className="h-4 w-4 text-primary animate-spin shrink-0" aria-hidden="true" />
                        ) : doc.status === "error" ? (
                          <AlertCircle className="h-4 w-4 text-danger shrink-0" aria-hidden="true" />
                        ) : (
                          <Clock className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
                        )}
                        <span className="text-sm text-text truncate">{doc.title ?? t("knowledge.untitled", { defaultValue: "Untitled" })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-tertiary">{doc.chunkCount ?? 0} {t("knowledge.chunks", { defaultValue: "chunks" })}</span>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Indexing jobs */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text">{t("knowledge.indexingJobs", { defaultValue: "Indexing Jobs" })}</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => reindexMutation.mutate()}
                disabled={reindexMutation.isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${reindexMutation.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
                {t("knowledge.reindexAll", { defaultValue: "Re-index All" })}
              </Button>
            </div>

            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-surface-secondary flex items-center justify-center mb-4">
                  <Activity className="h-7 w-7 text-text-tertiary" aria-hidden="true" />
                </div>
                <h3 className="text-base font-medium text-text mb-1">{t("knowledge.noActivity", { defaultValue: "No indexing activity" })}</h3>
                <p className="text-sm text-text-secondary max-w-sm">
                  {t("knowledge.noActivityDesc", { defaultValue: "Indexing jobs will appear here when documents are added or re-indexed." })}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => {
                  const progress =
                    job.documentCount > 0
                      ? Math.round((job.processedCount / job.documentCount) * 100)
                      : 0;

                  const statusIcon =
                    job.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
                    ) : job.status === "running" ? (
                      <RefreshCw className="h-4 w-4 text-primary animate-spin" aria-hidden="true" />
                    ) : job.status === "failed" ? (
                      <AlertCircle className="h-4 w-4 text-danger" aria-hidden="true" />
                    ) : (
                      <Clock className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                    );

                  return (
                    <div
                      key={job.id}
                      className="px-4 py-3 rounded-lg border border-border bg-surface"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {statusIcon}
                          <span className="text-sm font-medium text-text capitalize">{job.type}</span>
                          <Badge
                            variant={
                              job.status === "completed"
                                ? "success"
                                : job.status === "running"
                                  ? "primary"
                                  : job.status === "failed"
                                    ? "danger"
                                    : "default"
                            }
                          >
                            {job.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-text-tertiary">
                          {formatRelativeTime(job.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-text-secondary">
                        <span>
                          {job.processedCount}/{job.documentCount} {t("knowledge.documents", { defaultValue: "documents" })}
                        </span>
                        {job.startedAt && job.completedAt && (
                          <span>
                            {t("knowledge.duration", { defaultValue: "Duration" })}:{" "}
                            {Math.round(
                              (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000,
                            )}
                            s
                          </span>
                        )}
                      </div>

                      {job.status === "running" && (
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {job.error && (
                        <p className="mt-2 text-xs text-danger bg-danger/5 rounded px-2 py-1">
                          {job.error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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

    </div>
  );
}
