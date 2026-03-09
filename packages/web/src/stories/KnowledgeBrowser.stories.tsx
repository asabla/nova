import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  BookOpen, FileText, Upload, Search, Plus, MoreHorizontal,
  File, FileCode, FileSpreadsheet, Trash2, Download,
  CheckCircle, Clock, AlertTriangle, RefreshCw, X, Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const meta: Meta = {
  title: "Patterns/KnowledgeBrowser",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

// ── Mock Data ────────────────────────────────────────────────────────────

interface MockCollection {
  id: string;
  name: string;
  description: string;
  status: "ready" | "processing" | "error";
  documentCount: number;
  chunkCount: number;
  updatedAt: string;
}

interface MockDocument {
  id: string;
  name: string;
  type: "pdf" | "md" | "txt" | "csv" | "json";
  size: number;
  status: "indexed" | "processing" | "failed";
  chunks: number;
  uploadedAt: string;
}

const collections: MockCollection[] = [
  { id: "1", name: "Product Documentation", description: "Official product guides, API references, and tutorials", status: "ready", documentCount: 24, chunkCount: 1842, updatedAt: "2 hours ago" },
  { id: "2", name: "Engineering Wiki", description: "Internal engineering docs, ADRs, and runbooks", status: "ready", documentCount: 56, chunkCount: 4210, updatedAt: "1 day ago" },
  { id: "3", name: "Support Knowledge Base", description: "FAQ, troubleshooting guides, and known issues", status: "processing", documentCount: 12, chunkCount: 680, updatedAt: "5 min ago" },
  { id: "4", name: "Research Papers", description: "ML/AI research papers and technical reports", status: "ready", documentCount: 8, chunkCount: 2156, updatedAt: "3 days ago" },
  { id: "5", name: "Meeting Notes Q1", description: "Transcriptions and summaries from Q1 meetings", status: "error", documentCount: 3, chunkCount: 0, updatedAt: "1 week ago" },
  { id: "6", name: "Legal & Compliance", description: "Privacy policies, terms of service, compliance docs", status: "ready", documentCount: 15, chunkCount: 987, updatedAt: "2 weeks ago" },
];

const documents: MockDocument[] = [
  { id: "d1", name: "api-reference-v3.pdf", type: "pdf", size: 2_400_000, status: "indexed", chunks: 342, uploadedAt: "2 hours ago" },
  { id: "d2", name: "getting-started.md", type: "md", size: 45_000, status: "indexed", chunks: 28, uploadedAt: "2 hours ago" },
  { id: "d3", name: "architecture-overview.md", type: "md", size: 120_000, status: "indexed", chunks: 67, uploadedAt: "1 day ago" },
  { id: "d4", name: "error-codes.csv", type: "csv", size: 18_000, status: "indexed", chunks: 15, uploadedAt: "1 day ago" },
  { id: "d5", name: "config-schema.json", type: "json", size: 8_500, status: "indexed", chunks: 12, uploadedAt: "3 days ago" },
  { id: "d6", name: "migration-guide-v2-to-v3.pdf", type: "pdf", size: 890_000, status: "processing", chunks: 0, uploadedAt: "5 min ago" },
  { id: "d7", name: "webhook-examples.md", type: "md", size: 32_000, status: "failed", chunks: 0, uploadedAt: "5 min ago" },
];

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

const typeIcons: Record<string, typeof File> = {
  pdf: File,
  md: FileCode,
  txt: FileText,
  csv: FileSpreadsheet,
  json: FileCode,
};

function StatusBadge({ status }: { status: string }) {
  const variant = status === "ready" || status === "indexed" ? "success" : status === "processing" ? "warning" : "danger";
  return <Badge variant={variant}>{status}</Badge>;
}

// ── Stories ───────────────────────────────────────────────────────────────

/** Collection grid with status indicators */
export const CollectionList: Story = {
  render: () => {
    const [search, setSearch] = useState("");
    const filtered = search
      ? collections.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      : collections;

    return (
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Knowledge Base</h1>
            <p className="text-sm text-text-secondary mt-1">
              Upload documents and build collections for RAG-powered conversations
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-1.5" />
            New Collection
          </Button>
        </div>

        <div className="relative max-w-xs mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search collections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary field-glow"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((col) => (
            <div
              key={col.id}
              className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <StatusBadge status={col.status} />
              </div>
              <h3 className="text-sm font-semibold text-text mb-1">{col.name}</h3>
              <p className="text-xs text-text-tertiary mb-3">{col.description}</p>
              <div className="flex items-center gap-3 text-[10px] text-text-tertiary mt-auto">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {col.documentCount} docs
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {col.chunkCount} chunks
                </span>
                <span className="ml-auto">{col.updatedAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

/** Document list within a collection */
export const DocumentList: Story = {
  render: () => (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-text">Product Documentation</h2>
          <p className="text-xs text-text-tertiary">24 documents · 1,842 chunks · Last updated 2 hours ago</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Reindex
          </Button>
          <Button size="sm">
            <Upload className="h-3.5 w-3.5 mr-1" />
            Upload
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-tertiary/50 border-b border-border">
              <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">Size</th>
              <th className="text-center px-4 py-2.5 font-medium text-text-tertiary">Chunks</th>
              <th className="text-center px-4 py-2.5 font-medium text-text-tertiary">Status</th>
              <th className="text-right px-4 py-2.5 font-medium text-text-tertiary">Uploaded</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {documents.map((doc) => {
              const Icon = typeIcons[doc.type] ?? File;
              return (
                <tr key={doc.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-text-tertiary shrink-0" />
                      <span className="text-text font-medium truncate">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{formatSize(doc.size)}</td>
                  <td className="px-4 py-2.5 text-center text-text-secondary">
                    {doc.chunks > 0 ? doc.chunks : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center"><StatusBadge status={doc.status} /></td>
                  <td className="px-4 py-2.5 text-right text-text-tertiary">{doc.uploadedAt}</td>
                  <td className="px-2 py-2.5">
                    <button className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-text transition-colors">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  ),
};

/** Upload area with drag-and-drop zone */
export const UploadArea: Story = {
  render: () => {
    const [files, setFiles] = useState<{ name: string; size: number; progress: number }[]>([
      { name: "deployment-guide.pdf", size: 3_200_000, progress: 100 },
      { name: "api-changelog.md", size: 78_000, progress: 65 },
      { name: "troubleshooting.pdf", size: 1_500_000, progress: 30 },
    ]);

    return (
      <div className="max-w-lg">
        <h3 className="text-sm font-semibold text-text mb-3">Upload Documents</h3>

        {/* Drag & drop zone */}
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer mb-4">
          <Upload className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-text mb-1">
            Drag & drop files here, or <span className="text-primary font-medium">browse</span>
          </p>
          <p className="text-xs text-text-tertiary">
            PDF, Markdown, TXT, CSV, JSON — up to 50MB per file
          </p>
        </div>

        {/* Upload progress */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-secondary">
                <File className="h-4 w-4 text-text-tertiary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-text truncate">{f.name}</span>
                    <span className="text-[10px] text-text-tertiary shrink-0 ml-2">{formatSize(f.size)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all",
                        f.progress === 100 ? "bg-success" : "bg-primary",
                      )}
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                </div>
                {f.progress === 100 ? (
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <button className="p-0.5 text-text-tertiary hover:text-text transition-colors shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
};

/** Empty collection state */
export const EmptyCollection: Story = {
  render: () => (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text">Knowledge Base</h1>
          <p className="text-sm text-text-secondary mt-1">
            Upload documents and build collections for RAG-powered conversations
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-1.5" />
          New Collection
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-text mb-2">No knowledge collections</h2>
        <p className="text-sm text-text-secondary max-w-sm mb-6">
          Upload documents and organize them into collections. Agents can use these for context-aware answers.
        </p>
        <Button>
          <Upload className="h-4 w-4 mr-1.5" />
          Upload Documents
        </Button>
      </div>
    </div>
  ),
};
