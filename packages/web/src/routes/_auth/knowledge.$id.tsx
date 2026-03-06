import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ArrowLeft,
  Save,
  Trash2,
  FileText,
  Upload,
  Link,
  RefreshCw,
  Search,
  Settings2,
  TestTube,
  Activity,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  FileUp,
  Globe,
  Layers,
  Zap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { toast } from "../../components/ui/Toast";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

export const Route = createFileRoute("/_auth/knowledge/$id")({
  component: KnowledgeDetailPage,
});

type TabId = "documents" | "settings" | "test" | "activity";

interface KnowledgeDocument {
  id: string;
  name: string;
  type: "file" | "url";
  url?: string;
  mimeType?: string;
  size?: number;
  chunkCount: number;
  status: "pending" | "indexing" | "ready" | "error";
  error?: string;
  createdAt: string;
  updatedAt: string;
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
  metadata?: Record<string, unknown>;
}

interface KnowledgeCollection {
  id: string;
  name: string;
  description?: string;
  status: string;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  documentCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>("documents");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<RetrievedChunk[] | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const { data: collection, isLoading } = useQuery({
    queryKey: queryKeys.knowledge.detail(id),
    queryFn: () => api.get<KnowledgeCollection>(`/api/knowledge/${id}`),
  });

  const { data: documentsData } = useQuery({
    queryKey: [...queryKeys.knowledge.detail(id), "documents"],
    queryFn: () => api.get<{ data: KnowledgeDocument[] }>(`/api/knowledge/${id}/documents`),
  });

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

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => api.patch(`/api/knowledge/${id}`, data),
    onSuccess: () => {
      toast("Collection updated", "success");
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list() });
    },
    onError: (err: any) => toast(err.message ?? "Update failed", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/knowledge/${id}`),
    onSuccess: () => {
      toast("Collection deleted", "success");
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list() });
      navigate({ to: "/knowledge" });
    },
    onError: (err: any) => toast(err.message ?? "Delete failed", "error"),
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const url = `${import.meta.env.VITE_API_URL ?? ""}/api/knowledge/${id}/documents/upload`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({ title: "Upload failed" }));
        throw new Error(problem.title ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast("Files uploaded successfully", "success");
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(id), "documents"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
    },
    onError: (err: any) => toast(err.message ?? "Upload failed", "error"),
  });

  const addUrlMutation = useMutation({
    mutationFn: (url: string) =>
      api.post(`/api/knowledge/${id}/documents`, { type: "url", url }),
    onSuccess: () => {
      toast("URL added successfully", "success");
      setUrlValue("");
      setShowUrlInput(false);
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(id), "documents"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
    },
    onError: (err: any) => toast(err.message ?? "Failed to add URL", "error"),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/api/knowledge/${id}/documents/${docId}`),
    onSuccess: () => {
      toast("Document removed", "success");
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(id), "documents"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
    },
    onError: (err: any) => toast(err.message ?? "Delete failed", "error"),
  });

  const reindexMutation = useMutation({
    mutationFn: () => api.post(`/api/knowledge/${id}/reindex`),
    onSuccess: () => {
      toast("Re-indexing started", "success");
      queryClient.invalidateQueries({ queryKey: [...queryKeys.knowledge.detail(id), "activity"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
    },
    onError: (err: any) => toast(err.message ?? "Re-index failed", "error"),
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
      toast(err.message ?? "Query failed", "error");
    } finally {
      setTestLoading(false);
    }
  };

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
      toast("Please enter a valid URL", "error");
      return;
    }
    addUrlMutation.mutate(trimmed);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-text-secondary">Loading collection...</div>
      </div>
    );
  }

  const tabs = [
    { id: "documents" as const, label: "Documents", icon: FileText },
    { id: "settings" as const, label: "Settings", icon: Settings2 },
    { id: "test" as const, label: "Test", icon: TestTube },
    { id: "activity" as const, label: "Activity", icon: Activity },
  ];

  const col = collection as KnowledgeCollection | undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/knowledge" })}
            className="p-1 hover:bg-surface-secondary rounded"
          >
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text">{col?.name ?? "Collection"}</h1>
            <p className="text-sm text-text-secondary">
              {col?.documentCount ?? 0} documents, {col?.chunkCount ?? 0} chunks
            </p>
          </div>
          {col?.status && (
            <Badge variant={col.status === "ready" ? "success" : col.status === "indexing" ? "warning" : "default"}>
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
            <RefreshCw className={`h-3.5 w-3.5 ${reindexMutation.isPending ? "animate-spin" : ""}`} />
            {reindexMutation.isPending ? "Re-indexing..." : "Re-index"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={() => {
              if (confirm("Delete this collection and all its documents?")) {
                deleteMutation.mutate();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
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
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Documents Tab */}
        {activeTab === "documents" && (
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
                <FileUp className="h-3.5 w-3.5" />
                {uploadMutation.isPending ? "Uploading..." : "Upload Files"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowUrlInput(!showUrlInput)}>
                <Globe className="h-3.5 w-3.5" />
                Add URL
              </Button>
            </div>

            {/* URL input */}
            {showUrlInput && (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface">
                  <Link className="h-4 w-4 text-text-tertiary shrink-0" />
                  <input
                    type="url"
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                    placeholder="https://example.com/document.pdf"
                    className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-text-tertiary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUrlSubmit();
                      if (e.key === "Escape") {
                        setShowUrlInput(false);
                        setUrlValue("");
                      }
                    }}
                    autoFocus
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUrlSubmit}
                  disabled={addUrlMutation.isPending || !urlValue.trim()}
                >
                  {addUrlMutation.isPending ? "Adding..." : "Add"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowUrlInput(false);
                    setUrlValue("");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Documents list */}
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-surface-secondary flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-text-tertiary" />
                </div>
                <h3 className="text-base font-medium text-text mb-1">No documents yet</h3>
                <p className="text-sm text-text-secondary max-w-sm">
                  Upload files or add URLs to build this knowledge collection.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-surface hover:bg-surface-secondary transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-surface-secondary flex items-center justify-center shrink-0">
                        {doc.type === "url" ? (
                          <Globe className="h-4 w-4 text-text-tertiary" />
                        ) : (
                          <FileText className="h-4 w-4 text-text-tertiary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 text-xs text-text-tertiary">
                          {doc.type === "url" && doc.url && (
                            <span className="truncate max-w-[200px]">{doc.url}</span>
                          )}
                          {doc.size != null && <span>{formatFileSize(doc.size)}</span>}
                          <span>{doc.chunkCount} chunks</span>
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
                        onClick={() => {
                          if (confirm(`Remove "${doc.name}" from this collection?`)) {
                            deleteDocMutation.mutate(doc.id);
                          }
                        }}
                        className="p-1.5 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What kind of documents does this collection contain?"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm"
              />
            </div>

            <div className="pt-2 border-t border-border">
              <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 text-text-secondary" />
                Embedding Configuration
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Embedding Model</label>
                  <select
                    value={form.embeddingModel}
                    onChange={(e) => setForm({ ...form, embeddingModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                  >
                    <option value="text-embedding-3-small">text-embedding-3-small (1536d, fast)</option>
                    <option value="text-embedding-3-large">text-embedding-3-large (3072d, accurate)</option>
                    <option value="text-embedding-ada-002">text-embedding-ada-002 (1536d, legacy)</option>
                    <option value="nomic-embed-text">nomic-embed-text (768d, open-source)</option>
                    <option value="mxbai-embed-large">mxbai-embed-large (1024d, open-source)</option>
                  </select>
                  <p className="text-xs text-text-tertiary mt-1">
                    Changing the model will require a full re-index of all documents.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">Chunk Size (tokens)</label>
                    <input
                      type="number"
                      value={form.chunkSize}
                      onChange={(e) => setForm({ ...form, chunkSize: Math.max(64, parseInt(e.target.value) || 512) })}
                      min={64}
                      max={8192}
                      step={64}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                    />
                    <p className="text-xs text-text-tertiary mt-1">64 - 8192. Smaller = more precise retrieval.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">Chunk Overlap (tokens)</label>
                    <input
                      type="number"
                      value={form.chunkOverlap}
                      onChange={(e) => setForm({ ...form, chunkOverlap: Math.max(0, parseInt(e.target.value) || 50) })}
                      min={0}
                      max={form.chunkSize / 2}
                      step={10}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                    />
                    <p className="text-xs text-text-tertiary mt-1">
                      Overlap between consecutive chunks for context continuity.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="text-xs text-text-tertiary space-y-1">
                {col && (
                  <>
                    <p>Created: {new Date(col.createdAt).toLocaleDateString()}</p>
                    <p>Updated: {new Date(col.updatedAt).toLocaleDateString()}</p>
                  </>
                )}
              </div>
              <Button
                variant="primary"
                onClick={() => updateMutation.mutate(form)}
                disabled={updateMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}

        {/* Test Tab */}
        {activeTab === "test" && (
          <div className="max-w-3xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Test Query
              </label>
              <p className="text-xs text-text-secondary mb-3">
                Enter a natural language query to test retrieval against this collection. Results show the most relevant chunks with similarity scores.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface">
                  <Search className="h-4 w-4 text-text-tertiary shrink-0" />
                  <input
                    type="text"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder="What is the refund policy?"
                    className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-text-tertiary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTest();
                    }}
                  />
                </div>
                <Button variant="primary" onClick={handleTest} disabled={testLoading || !testQuery.trim()}>
                  <TestTube className="h-4 w-4" />
                  {testLoading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>

            {/* Results */}
            {testResults !== null && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text">
                    Retrieved Chunks ({testResults.length})
                  </h3>
                  {testResults.length > 0 && (
                    <span className="text-xs text-text-tertiary">Sorted by relevance</span>
                  )}
                </div>

                {testResults.length === 0 ? (
                  <div className="px-4 py-8 rounded-lg border border-border bg-surface text-center">
                    <Search className="h-8 w-8 text-text-tertiary mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">No relevant chunks found for this query.</p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Try a different query, or make sure documents have been indexed.
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
                          <FileText className="h-3 w-3" />
                          <span className="font-medium truncate max-w-[300px]">{chunk.documentName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-warning" />
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

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text">Indexing Jobs</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => reindexMutation.mutate()}
                disabled={reindexMutation.isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${reindexMutation.isPending ? "animate-spin" : ""}`} />
                Re-index All
              </Button>
            </div>

            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-surface-secondary flex items-center justify-center mb-4">
                  <Activity className="h-7 w-7 text-text-tertiary" />
                </div>
                <h3 className="text-base font-medium text-text mb-1">No indexing activity</h3>
                <p className="text-sm text-text-secondary max-w-sm">
                  Indexing jobs will appear here when documents are added or re-indexed.
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
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : job.status === "running" ? (
                      <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                    ) : job.status === "failed" ? (
                      <AlertCircle className="h-4 w-4 text-danger" />
                    ) : (
                      <Clock className="h-4 w-4 text-text-tertiary" />
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
                          {job.processedCount}/{job.documentCount} documents
                        </span>
                        {job.startedAt && job.completedAt && (
                          <span>
                            Duration:{" "}
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
    </div>
  );
}
