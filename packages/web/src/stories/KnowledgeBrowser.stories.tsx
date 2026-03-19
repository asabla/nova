import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  BookOpen, FileText, Upload, Search, Plus, MoreHorizontal,
  File, FileCode, FileSpreadsheet, Trash2, Download, Eye,
  CheckCircle, Clock, AlertTriangle, RefreshCw, X, Layers,
  Globe, Settings2, ChevronDown, Save,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

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
  type: "pdf" | "md" | "txt" | "csv" | "json" | "url";
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
  url: Globe,
};

function StatusBadge({ status }: { status: string }) {
  const variant = status === "ready" || status === "indexed" ? "success" : status === "processing" ? "warning" : "danger";
  return <Badge variant={variant}>{status}</Badge>;
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? "bg-success" : score >= 0.5 ? "bg-warning" : "bg-text-tertiary";
  const textColor = score >= 0.8 ? "text-success" : score >= 0.5 ? "text-warning" : "text-text-tertiary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-surface-secondary overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${textColor}`}>{pct}%</span>
    </div>
  );
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary z-10" />
          <Input
            type="text"
            placeholder="Search collections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 pr-3 text-sm"
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

/** Document list with table layout and search */
export const DocumentList: Story = {
  render: () => {
    const [search, setSearch] = useState("");
    const filtered = search
      ? documents.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
      : documents;

    return (
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
            <Button variant="secondary" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>

        <div className="relative max-w-xs mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary z-10" />
          <Input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-9 pr-3 text-sm"
          />
        </div>

        <div className="rounded-xl border border-border">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-surface-tertiary/50">
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Name</TableHead>
                <TableHead className="px-4 py-2.5 text-center text-xs font-medium text-text-tertiary">Status</TableHead>
                <TableHead className="px-4 py-2.5 text-center text-xs font-medium text-text-tertiary">Chunks</TableHead>
                <TableHead className="px-4 py-2.5 text-right text-xs font-medium text-text-tertiary">Size</TableHead>
                <TableHead className="px-4 py-2.5 text-right text-xs font-medium text-text-tertiary">Added</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {filtered.map((doc) => {
                const Icon = typeIcons[doc.type] ?? File;
                return (
                  <TableRow key={doc.id} className="group cursor-pointer">
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-text-tertiary shrink-0" />
                        <span className="text-text font-medium truncate">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-center"><StatusBadge status={doc.status} /></TableCell>
                    <TableCell className="px-4 py-2.5 text-center text-text-secondary">
                      {doc.chunks > 0 ? doc.chunks : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right text-text-secondary">{formatSize(doc.size)}</TableCell>
                    <TableCell className="px-4 py-2.5 text-right text-text-tertiary">{doc.uploadedAt}</TableCell>
                    <TableCell className="px-2 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-text transition-colors">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-danger transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  },
};

/** Document preview dialog */
export const DocumentPreview: Story = {
  render: () => (
    <div className="max-w-2xl bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text">api-reference-v3.pdf</h2>
        <button className="text-text-tertiary hover:text-text p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <File className="h-3.5 w-3.5" />
          <span>Uploaded file</span>
        </div>
        <Badge variant="success">ready</Badge>
        <span className="text-xs text-text-tertiary">24,500 tokens</span>
        <span className="text-xs text-text-tertiary flex items-center gap-1">
          <Layers className="h-3 w-3" /> 342 chunks
        </span>
        <span className="text-xs text-text-tertiary flex items-center gap-1">
          <Clock className="h-3 w-3" /> 2h ago
        </span>
      </div>

      <div className="max-h-[40vh] overflow-auto rounded-lg border border-border bg-surface-secondary p-4">
        <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
          {`# API Reference v3

## Authentication

All API requests require authentication using Bearer tokens. Include your API key in the Authorization header:

\`\`\`
Authorization: Bearer your-api-key-here
\`\`\`

## Endpoints

### GET /api/v3/users
Returns a paginated list of users in your organization.

**Parameters:**
- \`limit\` (optional, default: 20) - Number of results per page
- \`offset\` (optional, default: 0) - Pagination offset
- \`search\` (optional) - Filter users by name or email

**Response:**
\`\`\`json
{
  "data": [...],
  "total": 150,
  "limit": 20,
  "offset": 0
}
\`\`\``}
        </p>
      </div>

      <details className="mt-4">
        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-xs text-text-secondary hover:text-text">
          <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
          View individual chunks (342)
        </summary>
      </details>
    </div>
  ),
};

/** Search tab with results and relevance bars */
export const SearchResults: Story = {
  render: () => {
    const results = [
      { id: "r1", documentName: "api-reference-v3.pdf", score: 0.92, content: "All API requests require authentication using Bearer tokens. Include your API key in the Authorization header. Tokens can be generated from the dashboard under Settings > API Keys." },
      { id: "r2", documentName: "getting-started.md", score: 0.78, content: "To authenticate with the API, first create an API key from your dashboard. Navigate to Settings, then API Keys, and click 'Generate New Key'. Store this key securely — it won't be shown again." },
      { id: "r3", documentName: "architecture-overview.md", score: 0.61, content: "The authentication layer uses JWT tokens with RS256 signing. Tokens are validated at the API gateway level before requests reach the application server. Token expiry is set to 24 hours by default." },
      { id: "r4", documentName: "error-codes.csv", score: 0.45, content: "401,Unauthorized,\"The provided authentication token is invalid, expired, or missing. Ensure you're including a valid Bearer token in the Authorization header.\"" },
      { id: "r5", documentName: "migration-guide-v2-to-v3.pdf", score: 0.32, content: "Authentication in v3 has been updated to use OAuth 2.0 flows instead of simple API keys. Existing v2 API keys will continue to work during the migration period but will be deprecated on March 1st." },
    ];

    return (
      <div className="max-w-3xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">Search</label>
          <p className="text-xs text-text-secondary mb-3">
            Enter a natural language query to find relevant content in this collection.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface input-glow">
              <Search className="h-4 w-4 text-text-tertiary shrink-0" />
              <span className="text-sm text-text">How does authentication work?</span>
            </div>
            <Button variant="primary">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text">Results ({results.length})</h3>
            <span className="text-xs text-text-tertiary">Sorted by relevance</span>
          </div>

          {results.map((result) => (
            <div key={result.id} className="rounded-lg border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-surface-secondary border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  <span className="text-sm font-medium text-text truncate">{result.documentName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <RelevanceBar score={result.score} />
                  <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <Eye className="h-3 w-3" />
                    View in document
                  </button>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-text whitespace-pre-wrap leading-relaxed line-clamp-3">{result.content}</p>
                <button className="text-xs text-primary hover:text-primary/80 mt-1">Show more</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

/** Search tab empty state */
export const SearchEmpty: Story = {
  render: () => (
    <div className="max-w-3xl space-y-4">
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">Search</label>
        <p className="text-xs text-text-secondary mb-3">
          Enter a natural language query to find relevant content in this collection.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface input-glow">
            <Search className="h-4 w-4 text-text-tertiary shrink-0" />
            <span className="text-sm text-text">quantum teleportation recipe</span>
          </div>
          <Button variant="primary">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text">Results (0)</h3>
        <EmptyState
          icon={<Search className="h-7 w-7" />}
          title="No relevant results found"
          description="Try a different query, or make sure documents have been indexed."
        />
      </div>
    </div>
  ),
};

/** Settings form with collapsible advanced section */
export const SettingsForm: Story = {
  render: () => (
    <div className="max-w-2xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">Name</label>
        <input
          type="text"
          defaultValue="Product Documentation"
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1.5">Description</label>
        <textarea
          defaultValue="Official product guides, API references, and tutorials"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm resize-none"
        />
      </div>

      <details className="pt-2 border-t border-border">
        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-4 w-4 text-text-secondary -rotate-90" />
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <Layers className="h-4 w-4 text-text-secondary" />
            Advanced Configuration
          </h3>
        </summary>
        <p className="text-xs text-text-tertiary mt-1 mb-4 ml-6">
          These settings affect how documents are processed. Changing them requires re-indexing.
        </p>
        <div className="space-y-4 ml-6">
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Embedding Model</label>
            <select className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm">
              <option>text-embedding-3-small</option>
              <option>text-embedding-3-large</option>
            </select>
            <p className="text-xs text-text-tertiary mt-1">Changing the model will require a full re-index of all documents.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Chunk Size (tokens)</label>
              <input type="number" defaultValue={512} className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Chunk Overlap (tokens)</label>
              <input type="number" defaultValue={50} className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm" />
            </div>
          </div>
        </div>
      </details>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="text-xs text-text-tertiary space-y-1">
          <p>Created: 1/15/2026</p>
          <p>Updated: 3/18/2026</p>
          <p>Last indexed: 3/18/2026</p>
          <p>Version: 3</p>
        </div>
        <Button>
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>

      <div className="rounded-lg border border-danger/30 p-4">
        <h3 className="text-sm font-semibold text-danger mb-1">Danger Zone</h3>
        <p className="text-xs text-text-secondary mb-3">
          Permanently delete this collection and all its documents. This action cannot be undone.
        </p>
        <Button variant="danger" size="sm">
          <Trash2 className="h-3.5 w-3.5" />
          Delete Collection
        </Button>
      </div>
    </div>
  ),
};

/** Activity tab with stats and audit history timeline */
export const ActivityTimeline: Story = {
  render: () => {
    const history = [
      { id: "h1", action: "knowledge.document.create", label: "Document added", detail: "api-reference-v3.pdf", time: "2h ago", icon: Plus },
      { id: "h2", action: "knowledge.document.index", label: "Document indexed", detail: "api-reference-v3.pdf", time: "2h ago", icon: RefreshCw },
      { id: "h3", action: "knowledge.document.create", label: "Document added", detail: "getting-started.md", time: "2h ago", icon: Plus },
      { id: "h4", action: "knowledge.document.index", label: "Document indexed", detail: "getting-started.md", time: "2h ago", icon: RefreshCw },
      { id: "h5", action: "knowledge.collection.reindex", label: "Re-index started", detail: undefined, time: "1d ago", icon: RefreshCw },
      { id: "h6", action: "knowledge.collection.update", label: "Collection updated", detail: undefined, time: "3d ago", icon: Settings2 },
      { id: "h7", action: "knowledge.collection.create", label: "Collection created", detail: undefined, time: "1w ago", icon: Plus },
    ];

    return (
      <div className="max-w-3xl space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-text-tertiary mb-1">Documents</p>
            <p className="text-2xl font-semibold text-text">24</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-text-tertiary mb-1">Total Chunks</p>
            <p className="text-2xl font-semibold text-text">1,842</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-text-tertiary mb-1">Status</p>
            <p className="text-2xl font-semibold text-text capitalize">ready</p>
          </div>
        </div>

        {/* Document indexing status */}
        <div>
          <h3 className="text-sm font-medium text-text mb-3">Document Indexing Status</h3>
          <div className="space-y-1">
            {[
              { name: "api-reference-v3.pdf", status: "ready", chunks: 342 },
              { name: "getting-started.md", status: "ready", chunks: 28 },
              { name: "migration-guide-v2-to-v3.pdf", status: "indexing", chunks: 0 },
              { name: "webhook-examples.md", status: "error", chunks: 0 },
            ].map((doc, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded border border-border bg-surface">
                <div className="flex items-center gap-2 min-w-0">
                  {doc.status === "ready" ? (
                    <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  ) : doc.status === "indexing" ? (
                    <RefreshCw className="h-4 w-4 text-primary animate-spin shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                  )}
                  <span className="text-sm text-text truncate">{doc.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">{doc.chunks} chunks</span>
                  <StatusBadge status={doc.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* History timeline */}
        <div>
          <h3 className="text-sm font-medium text-text mb-3">History</h3>
          <div className="space-y-0">
            {history.map((entry, idx) => {
              const Icon = entry.icon;
              const isLast = idx === history.length - 1;
              return (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-7 w-7 rounded-full bg-surface-secondary flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-text-secondary" />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-4 pt-0.5 min-w-0">
                    <p className="text-sm text-text">{entry.label}</p>
                    {entry.detail && <p className="text-xs text-text-secondary truncate">{entry.detail}</p>}
                    <p className="text-xs text-text-tertiary mt-0.5">{entry.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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

      <EmptyState
        icon={<BookOpen className="h-8 w-8" />}
        title="No knowledge collections"
        description="Upload documents and organize them into collections. Agents can use these for context-aware answers."
        action={
          <Button>
            <Upload className="h-4 w-4 mr-1.5" />
            Upload Documents
          </Button>
        }
      />
    </div>
  ),
};
