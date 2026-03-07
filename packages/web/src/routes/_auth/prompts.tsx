import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FileText,
  Plus,
  Search,
  Copy,
  Trash2,
  GitFork,
  Star,
  Tag,
  History,
  Eye,
  EyeOff,
  Users,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { Badge } from "../../components/ui/Badge";

export const Route = createFileRoute("/_auth/prompts")({
  component: PromptsPage,
});

// --- Types ---

interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  tags: string[] | null;
  visibility: string;
  currentVersion: number;
  avgRating: string | null;
  usageCount: number;
  forkedFromTemplateId: string | null;
  variables: unknown;
  systemPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PromptVersion {
  id: string;
  version: number;
  content: string;
  variables: unknown;
  systemPrompt: string | null;
  changelog: string | null;
  createdAt: string;
}

// --- Main Page ---

function PromptsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);

  const { data: promptsData } = useQuery({
    queryKey: ["prompts", search, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      return api.get<{ data: PromptTemplate[]; total: number }>(`/api/prompts?${params}`);
    },
  });

  const deletePrompt = useMutation({
    mutationFn: (id: string) => api.delete(`/api/prompts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompts"] }),
  });

  const forkPrompt = useMutation({
    mutationFn: (id: string) => api.post<PromptTemplate>(`/api/prompts/${id}/fork`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompts"] }),
  });

  const prompts = promptsData?.data ?? [];

  // Extract unique categories for the filter
  const categories = [...new Set(prompts.map((p) => p.category).filter(Boolean))] as string[];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Prompt Library</h1>
            <p className="text-sm text-text-secondary mt-1">
              Save, version, fork, and share reusable prompt templates
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 text-sm rounded-xl bg-surface-secondary border border-border text-text placeholder:text-text-tertiary focus:outline-primary"
            />
          </div>
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 px-3 text-sm rounded-xl bg-surface-secondary border border-border text-text focus:outline-primary"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Prompts Grid */}
        {prompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">No prompt templates</h2>
            <p className="text-sm text-text-secondary max-w-sm mb-6">
              Create reusable templates with variables to speed up your workflows.
            </p>
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create your first template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prompts.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                onSelect={() => setSelectedPrompt(p)}
                onFork={() => forkPrompt.mutate(p.id)}
                onDelete={() => deletePrompt.mutate(p.id)}
              />
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <CreatePromptDialog open={showCreate} onClose={() => setShowCreate(false)} />

        {/* Detail Dialog */}
        {selectedPrompt && (
          <PromptDetailDialog
            promptId={selectedPrompt.id}
            open={!!selectedPrompt}
            onClose={() => {
              setSelectedPrompt(null);
              queryClient.invalidateQueries({ queryKey: ["prompts"] });
            }}
          />
        )}
      </div>
    </div>
  );
}

// --- Prompt Card ---

function PromptCard({
  prompt,
  onSelect,
  onFork,
  onDelete,
}: {
  prompt: PromptTemplate;
  onSelect: () => void;
  onFork: () => void;
  onDelete: () => void;
}) {
  const tags = prompt.tags ?? [];
  const rating = prompt.avgRating ? parseFloat(prompt.avgRating) : null;

  return (
    <div className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <button onClick={onSelect} className="text-left flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text truncate">{prompt.name}</h3>
        </button>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {prompt.category && <Badge variant="default">{prompt.category}</Badge>}
          <VisibilityIcon visibility={prompt.visibility} />
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-text-tertiary mb-2 line-clamp-2">
        {prompt.description ?? "No description"}
      </p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Content Preview */}
      <pre className="text-xs bg-surface border border-border rounded-lg p-2 mb-3 overflow-hidden max-h-20 text-text-secondary font-mono">
        {prompt.content?.slice(0, 200)}
      </pre>

      {/* Footer: metadata + actions */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <History className="h-3 w-3" />
            v{prompt.currentVersion}
          </span>
          {rating !== null && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-warning text-warning" />
              {rating.toFixed(1)}
            </span>
          )}
          <span>{prompt.usageCount} uses</span>
          {prompt.forkedFromTemplateId && (
            <span className="flex items-center gap-1">
              <GitFork className="h-3 w-3" />
              fork
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onSelect}
            title="View details"
            className="text-text-tertiary hover:text-text-secondary p-1 rounded cursor-pointer transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(prompt.content)}
            title="Copy content"
            className="text-text-tertiary hover:text-text-secondary p-1 rounded cursor-pointer transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onFork}
            title="Fork template"
            className="text-text-tertiary hover:text-text-secondary p-1 rounded cursor-pointer transition-colors"
          >
            <GitFork className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="text-text-tertiary hover:text-danger p-1 rounded cursor-pointer transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Visibility Icon ---

function VisibilityIcon({ visibility }: { visibility: string }) {
  switch (visibility) {
    case "org":
      return (
        <span title="Visible to org" className="text-text-tertiary">
          <Users className="h-3.5 w-3.5" />
        </span>
      );
    case "team":
      return (
        <span title="Visible to team" className="text-text-tertiary">
          <Eye className="h-3.5 w-3.5" />
        </span>
      );
    default:
      return (
        <span title="Private" className="text-text-tertiary">
          <EyeOff className="h-3.5 w-3.5" />
        </span>
      );
  }
}

// --- Star Rating Component ---

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`p-0.5 ${readonly ? "cursor-default" : "cursor-pointer"}`}
        >
          <Star
            className={`h-4 w-4 ${
              star <= (hover || value)
                ? "fill-warning text-warning"
                : "text-text-tertiary"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// --- Prompt Detail Dialog ---

function PromptDetailDialog({
  promptId,
  open,
  onClose,
}: {
  promptId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"details" | "versions">("details");
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const { data: prompt } = useQuery({
    queryKey: ["prompts", promptId],
    queryFn: () => api.get<PromptTemplate>(`/api/prompts/${promptId}`),
    enabled: open,
  });

  const { data: versions } = useQuery({
    queryKey: ["prompts", promptId, "versions"],
    queryFn: () => api.get<PromptVersion[]>(`/api/prompts/${promptId}/versions`),
    enabled: open && activeTab === "versions",
  });

  const rateMutation = useMutation({
    mutationFn: (rating: number) => api.post(`/api/prompts/${promptId}/rate`, { rating }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompts", promptId] }),
  });

  const updateTagsMutation = useMutation({
    mutationFn: (tags: string[]) => api.patch(`/api/prompts/${promptId}/tags`, { tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts", promptId] });
      setEditingTags(false);
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: (visibility: string) =>
      api.patch(`/api/prompts/${promptId}/visibility`, { visibility }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompts", promptId] }),
  });

  if (!prompt) return null;

  const tags = (prompt.tags ?? []) as string[];
  const currentRating = prompt.avgRating ? parseFloat(prompt.avgRating) : 0;

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      updateTagsMutation.mutate([...tags, trimmed]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    updateTagsMutation.mutate(tags.filter((t) => t !== tag));
  };

  return (
    <Dialog open={open} onClose={onClose} title={prompt.name} className="max-w-2xl">
      {/* Tab Switcher */}
      <div className="flex border-b border-border mb-4">
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "details"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab("versions")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "versions"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <History className="h-3.5 w-3.5 inline mr-1" />
          Versions ({prompt.currentVersion})
        </button>
      </div>

      {activeTab === "details" && (
        <div className="space-y-4">
          {/* Description */}
          {prompt.description && (
            <p className="text-sm text-text-secondary">{prompt.description}</p>
          )}

          {/* Metadata Row */}
          <div className="flex items-center gap-4 text-sm">
            {prompt.category && <Badge variant="default">{prompt.category}</Badge>}
            <span className="text-text-tertiary">v{prompt.currentVersion}</span>
            <span className="text-text-tertiary">{prompt.usageCount} uses</span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Rate:</span>
            <StarRating value={Math.round(currentRating)} onChange={(r) => rateMutation.mutate(r)} />
            {currentRating > 0 && (
              <span className="text-sm text-text-tertiary">{currentRating.toFixed(1)}</span>
            )}
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Visibility:</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["private", "team", "org"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => updateVisibilityMutation.mutate(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    prompt.visibility === v
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-text-secondary">Tags:</span>
              {!editingTags && (
                <button
                  onClick={() => setEditingTags(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-primary/10 text-primary"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                  {editingTags && (
                    <button onClick={() => removeTag(tag)} className="hover:text-danger">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {editingTags && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addTag();
                  }}
                  className="inline-flex"
                >
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag..."
                    className="h-6 w-24 px-2 text-xs rounded-md border border-border bg-surface text-text placeholder:text-text-tertiary focus:outline-primary"
                    autoFocus
                  />
                </form>
              )}
              {editingTags && (
                <button
                  onClick={() => setEditingTags(false)}
                  className="text-xs text-text-tertiary hover:text-text"
                >
                  Done
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div>
            <span className="text-sm text-text-secondary block mb-1">Content:</span>
            <pre className="text-xs bg-surface border border-border rounded-lg p-3 overflow-auto max-h-64 text-text-secondary font-mono whitespace-pre-wrap">
              {prompt.content}
            </pre>
          </div>

          {/* System Prompt */}
          {prompt.systemPrompt && (
            <div>
              <span className="text-sm text-text-secondary block mb-1">System Prompt:</span>
              <pre className="text-xs bg-surface border border-border rounded-lg p-3 overflow-auto max-h-40 text-text-secondary font-mono whitespace-pre-wrap">
                {prompt.systemPrompt}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === "versions" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="primary" onClick={() => setShowNewVersion(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Version
            </Button>
          </div>

          {versions?.map((v) => (
            <VersionEntry key={v.id} version={v} />
          ))}

          {showNewVersion && (
            <CreateVersionForm
              promptId={promptId}
              onClose={() => setShowNewVersion(false)}
              onCreated={() => {
                setShowNewVersion(false);
                queryClient.invalidateQueries({ queryKey: ["prompts", promptId] });
              }}
            />
          )}
        </div>
      )}
    </Dialog>
  );
}

// --- Version Entry ---

function VersionEntry({ version }: { version: PromptVersion }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Badge variant="primary">v{version.version}</Badge>
          <span className="text-xs text-text-tertiary">
            {new Date(version.createdAt).toLocaleDateString()}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-text-tertiary" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-tertiary" />
        )}
      </button>

      {version.changelog && (
        <p className="text-xs text-text-secondary mt-1">{version.changelog}</p>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          <pre className="text-xs bg-surface border border-border rounded-lg p-2 overflow-auto max-h-48 text-text-secondary font-mono whitespace-pre-wrap">
            {version.content}
          </pre>
          {version.systemPrompt && (
            <div>
              <span className="text-[10px] uppercase tracking-wide text-text-tertiary">
                System Prompt
              </span>
              <pre className="text-xs bg-surface border border-border rounded-lg p-2 overflow-auto max-h-32 text-text-secondary font-mono whitespace-pre-wrap">
                {version.systemPrompt}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Create Version Form ---

function CreateVersionForm({
  promptId,
  onClose,
  onCreated,
}: {
  promptId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [changelog, setChangelog] = useState("");

  const create = useMutation({
    mutationFn: (data: { content: string; systemPrompt?: string; changelog?: string }) =>
      api.post(`/api/prompts/${promptId}/versions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts", promptId, "versions"] });
      onCreated();
    },
  });

  return (
    <div className="border border-primary/30 rounded-lg p-4 bg-primary/5">
      <h4 className="text-sm font-medium text-text mb-3">Create New Version</h4>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            content,
            systemPrompt: systemPrompt || undefined,
            changelog: changelog || undefined,
          });
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-xs font-medium text-text mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            required
            placeholder="Updated template content..."
            className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary focus:outline-primary resize-none font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            System Prompt (optional)
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={2}
            placeholder="System prompt for this version..."
            className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary focus:outline-primary resize-none font-mono"
          />
        </div>
        <Input
          label="Changelog (optional)"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="What changed in this version?"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={create.isPending}>
            Save Version
          </Button>
        </div>
      </form>
    </div>
  );
}

// --- Create Prompt Dialog ---

function CreatePromptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"private" | "team" | "org">("private");

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/api/prompts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      onClose();
      setName("");
      setDescription("");
      setContent("");
      setCategory("");
      setSystemPrompt("");
      setTags([]);
      setVisibility("private");
    },
  });

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Create Prompt Template" className="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            name,
            description: description || undefined,
            content,
            category: category || undefined,
            systemPrompt: systemPrompt || undefined,
            tags: tags.length > 0 ? tags : undefined,
            visibility,
          });
        }}
        className="space-y-4"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          label="Category (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., coding, writing, analysis"
        />

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">Tags (optional)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-primary/10 text-primary"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  className="hover:text-danger"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Type and press Enter..."
              className="flex-1 h-8 px-3 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary focus:outline-primary"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addTag}>
              Add
            </Button>
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">Visibility</label>
          <div className="flex rounded-lg border border-border overflow-hidden w-fit">
            {(["private", "team", "org"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  visibility === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            required
            placeholder="Use {{variable}} for template variables..."
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary focus:outline-primary resize-none font-mono"
          />
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            System Prompt (optional)
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            placeholder="System-level instructions..."
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary focus:outline-primary resize-none font-mono"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
