import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  Plus,
  Search,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  Code2,
  Globe,
  Puzzle,
  ShieldCheck,
  Store,
  ToggleLeft,
  ToggleRight,
  FileJson,
  Link,
  ChevronRight,
  BarChart3,
  Clock,
  Filter,
  Upload,
  Eye,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { toast } from "../../components/ui/Toast";
import { useAuthStore } from "../../stores/auth.store";

export const Route = createFileRoute("/_auth/tools")({
  component: ToolsPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tool {
  id: string;
  name: string;
  description?: string;
  type: "function" | "openapi" | "mcp";
  functionSchema?: Record<string, unknown>;
  endpoint?: string;
  isEnabled: boolean;
  isApproved: boolean;
  registeredById?: string;
  createdAt: string;
  updatedAt: string;
}

type TabId = "my-tools" | "marketplace" | "custom" | "admin";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOOL_CATEGORIES = ["All", "Function", "OpenAPI", "MCP"] as const;
type ToolCategory = (typeof TOOL_CATEGORIES)[number];

const categoryToType: Record<ToolCategory, string | null> = {
  All: null,
  Function: "function",
  OpenAPI: "openapi",
  MCP: "mcp",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function ToolsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "org-admin" || user?.role === "admin";
  const [activeTab, setActiveTab] = useState<TabId>("my-tools");

  const tabs: { id: TabId; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "my-tools", label: "My Tools", icon: <Wrench className="h-4 w-4" /> },
    { id: "marketplace", label: "Marketplace", icon: <Store className="h-4 w-4" /> },
    { id: "custom", label: "Custom Tools", icon: <Plus className="h-4 w-4" /> },
    { id: "admin", label: "Admin Review", icon: <ShieldCheck className="h-4 w-4" />, adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Wrench className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-text">Tools</h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text hover:border-border-strong"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "my-tools" && <MyToolsTab />}
        {activeTab === "marketplace" && <MarketplaceTab />}
        {activeTab === "custom" && <CustomToolsTab />}
        {activeTab === "admin" && isAdmin && <AdminReviewTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function typeIcon(type: string) {
  switch (type) {
    case "function":
      return <Code2 className="h-4 w-4 text-blue-400" />;
    case "openapi":
      return <Globe className="h-4 w-4 text-green-400" />;
    case "mcp":
      return <Puzzle className="h-4 w-4 text-purple-400" />;
    default:
      return <Wrench className="h-4 w-4 text-text-tertiary" />;
  }
}

function typeBadgeVariant(type: string): "default" | "primary" | "success" | "warning" {
  switch (type) {
    case "function":
      return "primary";
    case "openapi":
      return "success";
    case "mcp":
      return "default";
    default:
      return "default";
  }
}

// ---------------------------------------------------------------------------
// Tab 1: My Tools
// ---------------------------------------------------------------------------

function MyToolsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [detailTool, setDetailTool] = useState<Tool | null>(null);

  const { data: tools, isLoading } = useQuery({
    queryKey: ["tools"],
    queryFn: () => api.get<{ data: Tool[] }>("/api/tools"),
  });

  const toggleTool = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/tools/${id}`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      toast("Tool updated", "success");
    },
    onError: () => toast("Failed to update tool", "error"),
  });

  const deleteTool = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tools/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      toast("Tool deleted", "success");
    },
    onError: () => toast("Failed to delete tool", "error"),
  });

  const toolList = (tools as any)?.data ?? [];
  const filtered = search
    ? toolList.filter(
        (t: Tool) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : toolList;

  return (
    <>
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your tools..."
          className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary focus:outline-primary"
        />
      </div>

      {/* Tools List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-sm text-text-tertiary animate-pulse">Loading tools...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Wrench className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            {search ? "No tools match your search" : "No tools enabled yet"}
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            Browse the Marketplace to find tools, or register a custom one
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tool: Tool) => (
            <div
              key={tool.id}
              className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors"
            >
              <button
                className="flex items-center gap-3 text-left flex-1 min-w-0"
                onClick={() => setDetailTool(tool)}
              >
                {typeIcon(tool.type)}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text">{tool.name}</span>
                    <Badge variant={typeBadgeVariant(tool.type)}>{tool.type}</Badge>
                    {tool.isApproved && <Badge variant="success">Approved</Badge>}
                    {!tool.isEnabled && <Badge variant="warning">Disabled</Badge>}
                  </div>
                  {tool.description && (
                    <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{tool.description}</p>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {/* Toggle */}
                <button
                  onClick={() => toggleTool.mutate({ id: tool.id, isEnabled: !tool.isEnabled })}
                  className="p-1.5 text-text-tertiary hover:text-primary rounded-lg hover:bg-surface"
                  title={tool.isEnabled ? "Disable" : "Enable"}
                >
                  {tool.isEnabled ? (
                    <ToggleRight className="h-5 w-5 text-primary" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                {/* Detail */}
                <button
                  onClick={() => setDetailTool(tool)}
                  className="p-1.5 text-text-tertiary hover:text-primary rounded-lg hover:bg-surface"
                  title="Details"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {/* Delete */}
                <button
                  onClick={() => {
                    if (confirm("Delete this tool?")) deleteTool.mutate(tool.id);
                  }}
                  className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailTool && (
        <ToolDetailModal tool={detailTool} open={!!detailTool} onClose={() => setDetailTool(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Marketplace
// ---------------------------------------------------------------------------

function MarketplaceTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ToolCategory>("All");
  const [detailTool, setDetailTool] = useState<Tool | null>(null);

  const { data: marketplace, isLoading } = useQuery({
    queryKey: ["tools-marketplace", search, category],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const typeFilter = categoryToType[category];
      if (typeFilter) params.set("type", typeFilter);
      return api.get<{ data: Tool[] }>(`/api/tools/marketplace/browse?${params.toString()}`);
    },
  });

  const { data: myTools } = useQuery({
    queryKey: ["tools"],
    queryFn: () => api.get<{ data: Tool[] }>("/api/tools"),
  });

  const enabledIds = useMemo(() => {
    const list = (myTools as any)?.data ?? [];
    return new Set(list.map((t: Tool) => t.id));
  }, [myTools]);

  const toggleTool = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/tools/${id}`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      queryClient.invalidateQueries({ queryKey: ["tools-marketplace"] });
      toast("Tool updated", "success");
    },
    onError: () => toast("Failed to update tool", "error"),
  });

  const toolList = (marketplace as any)?.data ?? [];

  return (
    <>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Store className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-text mb-1">Tool Marketplace</h2>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Browse approved tools available in your organization. Enable them to use in conversations.
        </p>
      </div>

      {/* Search + Categories */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search marketplace..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary focus:outline-primary"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-text-tertiary mr-1" />
          {TOOL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                category === cat
                  ? "bg-primary/10 text-primary"
                  : "text-text-secondary hover:bg-surface-secondary hover:text-text"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-sm text-text-tertiary animate-pulse">Loading marketplace...</p>
        </div>
      ) : toolList.length === 0 ? (
        <div className="text-center py-16">
          <Store className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            {search || category !== "All" ? "No tools match your filters" : "No tools available yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {toolList.map((tool: Tool) => {
            const isEnabled = enabledIds.has(tool.id);
            return (
              <div
                key={tool.id}
                className="flex flex-col p-5 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    {typeIcon(tool.type)}
                  </div>
                  <Badge variant={typeBadgeVariant(tool.type)}>{tool.type}</Badge>
                </div>

                <h3 className="text-sm font-semibold text-text mb-1">{tool.name}</h3>
                {tool.description && (
                  <p className="text-xs text-text-tertiary leading-relaxed mb-3 line-clamp-2 flex-1">
                    {tool.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[10px] text-text-tertiary mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(tool.createdAt).toLocaleDateString()}
                  </span>
                  {tool.isApproved && (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle className="h-3 w-3" /> Approved
                    </span>
                  )}
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => setDetailTool(tool)}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark"
                  >
                    <Eye className="h-3 w-3" /> Details
                  </button>
                  <button
                    onClick={() => toggleTool.mutate({ id: tool.id, isEnabled: !isEnabled })}
                    className={`flex items-center gap-1 text-xs font-medium ml-auto ${
                      isEnabled
                        ? "text-text-secondary hover:text-text"
                        : "text-primary hover:text-primary-dark"
                    }`}
                  >
                    {isEnabled ? (
                      <>
                        <ToggleRight className="h-4 w-4" /> Enabled
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4" /> Enable
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {detailTool && (
        <ToolDetailModal tool={detailTool} open={!!detailTool} onClose={() => setDetailTool(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Custom Tools (Register via OpenAPI spec)
// ---------------------------------------------------------------------------

function CustomToolsTab() {
  const queryClient = useQueryClient();
  const [importMode, setImportMode] = useState<"paste" | "url">("paste");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [specText, setSpecText] = useState("");
  const [specUrl, setSpecUrl] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedSpec, setParsedSpec] = useState<Record<string, unknown> | null>(null);

  const createTool = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/api/tools", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      queryClient.invalidateQueries({ queryKey: ["tools-pending"] });
      resetForm();
      toast("Custom tool registered and submitted for review", "success");
    },
    onError: () => toast("Failed to register tool", "error"),
  });

  const fetchSpec = useMutation({
    mutationFn: async (url: string) => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status}`);
      return resp.text();
    },
    onSuccess: (text) => {
      setSpecText(text);
      tryParseSpec(text);
      toast("Spec fetched successfully", "success");
    },
    onError: (err: Error) => {
      setParseError(`Failed to fetch spec: ${err.message}`);
    },
  });

  function tryParseSpec(text: string) {
    setParseError(null);
    setParsedSpec(null);
    if (!text.trim()) return;
    try {
      const parsed = JSON.parse(text);
      setParsedSpec(parsed);
      // Auto-fill name/description from spec if available
      if (!name && (parsed.info?.title || parsed.name)) {
        setName(parsed.info?.title ?? parsed.name);
      }
      if (!description && (parsed.info?.description || parsed.description)) {
        setDescription(parsed.info?.description ?? parsed.description);
      }
    } catch {
      // Try YAML-like simple detection (just key: value on first lines)
      setParseError(
        "Could not parse as JSON. Please provide a valid JSON OpenAPI spec, or paste a JSON function schema.",
      );
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setSpecText("");
    setSpecUrl("");
    setParsedSpec(null);
    setParseError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("Tool name is required", "warning");
      return;
    }

    // If no parsed spec yet, try parsing now
    let schema = parsedSpec;
    if (!schema && specText.trim()) {
      try {
        schema = JSON.parse(specText);
      } catch {
        setParseError("Invalid JSON in spec field");
        return;
      }
    }

    const hasEndpoint = schema?.servers?.[0]?.url || schema?.endpoint;
    const isOpenApi = schema?.openapi || schema?.swagger;

    createTool.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      type: isOpenApi ? "openapi" : "function",
      schema: schema ?? {},
      endpoint: hasEndpoint ? String((schema as any)?.servers?.[0]?.url ?? (schema as any)?.endpoint ?? "") : undefined,
    });
  }

  // Count extracted operations from parsed spec
  const operationCount = useMemo(() => {
    if (!parsedSpec?.paths) return 0;
    let count = 0;
    const paths = parsedSpec.paths as Record<string, Record<string, unknown>>;
    for (const path of Object.values(paths)) {
      for (const method of Object.keys(path)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) count++;
      }
    }
    return count;
  }, [parsedSpec]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <FileJson className="h-6 w-6 text-green-400" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-text mb-1">Register Custom Tool</h2>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Import a tool by pasting an OpenAPI JSON spec or providing a URL. Custom tools are submitted for admin review before becoming available.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name + Description */}
        <Input
          label="Tool Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weather API, Code Formatter"
          required
        />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what this tool does"
        />

        {/* Import Mode Toggle */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">OpenAPI / Function Schema</label>
          <div className="flex items-center gap-1 mb-3">
            <button
              type="button"
              onClick={() => setImportMode("paste")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                importMode === "paste"
                  ? "bg-primary/10 text-primary"
                  : "text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              <FileJson className="h-3.5 w-3.5" /> Paste Spec
            </button>
            <button
              type="button"
              onClick={() => setImportMode("url")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                importMode === "url"
                  ? "bg-primary/10 text-primary"
                  : "text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              <Link className="h-3.5 w-3.5" /> Import from URL
            </button>
          </div>

          {importMode === "url" && (
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                value={specUrl}
                onChange={(e) => setSpecUrl(e.target.value)}
                placeholder="https://api.example.com/openapi.json"
                className="flex-1 h-10 px-3 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-tertiary focus:outline-primary"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => specUrl && fetchSpec.mutate(specUrl)}
                loading={fetchSpec.isPending}
              >
                <Upload className="h-3.5 w-3.5" /> Fetch
              </Button>
            </div>
          )}

          <textarea
            value={specText}
            onChange={(e) => {
              setSpecText(e.target.value);
              setParseError(null);
              setParsedSpec(null);
            }}
            onBlur={() => specText.trim() && tryParseSpec(specText)}
            rows={10}
            placeholder='{\n  "openapi": "3.0.0",\n  "info": { "title": "My Tool", "version": "1.0" },\n  "paths": { ... }\n}'
            className="w-full p-3 text-sm bg-surface border border-border rounded-lg text-text font-mono resize-y placeholder:text-text-tertiary focus:outline-primary"
          />

          {/* Parse status */}
          {parseError && (
            <div className="flex items-center gap-2 mt-2 text-xs text-danger">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {parseError}
            </div>
          )}
          {parsedSpec && (
            <div className="flex items-center gap-2 mt-2 text-xs text-success">
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              Spec parsed successfully
              {operationCount > 0 && <span>- {operationCount} operation{operationCount !== 1 ? "s" : ""} found</span>}
            </div>
          )}
        </div>

        {/* Parsed preview */}
        {parsedSpec && (
          <div className="p-4 rounded-xl bg-surface-secondary border border-border">
            <h3 className="text-xs font-semibold text-text mb-2 flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" /> Spec Preview
            </h3>
            <div className="space-y-1 text-xs text-text-secondary">
              {(parsedSpec as any).info?.title && (
                <p>
                  <span className="text-text-tertiary">Title:</span> {(parsedSpec as any).info.title}
                </p>
              )}
              {(parsedSpec as any).info?.version && (
                <p>
                  <span className="text-text-tertiary">Version:</span> {(parsedSpec as any).info.version}
                </p>
              )}
              {(parsedSpec as any).servers?.[0]?.url && (
                <p>
                  <span className="text-text-tertiary">Server:</span> {(parsedSpec as any).servers[0].url}
                </p>
              )}
              {operationCount > 0 && (
                <p>
                  <span className="text-text-tertiary">Operations:</span> {operationCount}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={resetForm}>
            Reset
          </Button>
          <Button type="submit" variant="primary" loading={createTool.isPending}>
            <Plus className="h-3.5 w-3.5" /> Register Tool
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Admin Review
// ---------------------------------------------------------------------------

function AdminReviewTab() {
  const queryClient = useQueryClient();

  const { data: pending, isLoading } = useQuery({
    queryKey: ["tools-pending"],
    queryFn: () => api.get<{ data: Tool[] }>("/api/tools?approved=false"),
  });

  // Fetch all tools and filter unapproved client-side as fallback
  const { data: allTools } = useQuery({
    queryKey: ["tools"],
    queryFn: () => api.get<{ data: Tool[] }>("/api/tools"),
  });

  const pendingList = useMemo(() => {
    const fromPending = (pending as any)?.data ?? [];
    if (fromPending.length > 0) return fromPending;
    // Fallback: filter all tools for unapproved
    const all = (allTools as any)?.data ?? [];
    return all.filter((t: Tool) => !t.isApproved);
  }, [pending, allTools]);

  const reviewTool = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      api.patch(`/api/tools/${id}`, { isApproved, isEnabled: isApproved }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      queryClient.invalidateQueries({ queryKey: ["tools-pending"] });
      queryClient.invalidateQueries({ queryKey: ["tools-marketplace"] });
      toast(vars.isApproved ? "Tool approved" : "Tool rejected", "success");
    },
    onError: () => toast("Failed to review tool", "error"),
  });

  const deleteTool = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tools/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      queryClient.invalidateQueries({ queryKey: ["tools-pending"] });
      toast("Tool deleted", "success");
    },
    onError: () => toast("Failed to delete tool", "error"),
  });

  const [detailTool, setDetailTool] = useState<Tool | null>(null);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text mb-1">Pending Review</h2>
        <p className="text-sm text-text-secondary">
          Review custom tools submitted by organization members. Approved tools become available in the marketplace.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-sm text-text-tertiary animate-pulse">Loading pending tools...</p>
        </div>
      ) : pendingList.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No tools pending review</p>
          <p className="text-xs text-text-tertiary mt-1">All submitted tools have been reviewed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingList.map((tool: Tool) => (
            <div
              key={tool.id}
              className="p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {typeIcon(tool.type)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text">{tool.name}</span>
                      <Badge variant={typeBadgeVariant(tool.type)}>{tool.type}</Badge>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                    {tool.description && (
                      <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{tool.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Submitted {new Date(tool.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <button
                    onClick={() => setDetailTool(tool)}
                    className="p-1.5 text-text-tertiary hover:text-primary rounded-lg hover:bg-surface"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => reviewTool.mutate({ id: tool.id, isApproved: true })}
                    className="p-1.5 text-text-tertiary hover:text-success rounded-lg hover:bg-surface"
                    title="Approve"
                    disabled={reviewTool.isPending}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => reviewTool.mutate({ id: tool.id, isApproved: false })}
                    className="p-1.5 text-text-tertiary hover:text-warning rounded-lg hover:bg-surface"
                    title="Reject"
                    disabled={reviewTool.isPending}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Permanently delete this tool?")) deleteTool.mutate(tool.id);
                    }}
                    className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailTool && (
        <ToolDetailModal tool={detailTool} open={!!detailTool} onClose={() => setDetailTool(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tool Detail Modal (with description, parameters, test panel)
// ---------------------------------------------------------------------------

function ToolDetailModal({ tool, open, onClose }: { tool: Tool; open: boolean; onClose: () => void }) {
  const [testInput, setTestInput] = useState("{}");
  const [testResult, setTestResult] = useState<any>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);

  const { data: callHistory } = useQuery({
    queryKey: ["tool-calls", tool.id],
    queryFn: () => api.get<{ data: any[] }>(`/api/tools/${tool.id}/calls`),
    enabled: open,
  });

  const testTool = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: string }) => {
      const parsed = JSON.parse(input);
      return api.post<any>(`/api/tools/${id}/test`, { input: parsed });
    },
    onSuccess: (data) => setTestResult(data),
    onError: (err: Error) => setTestResult({ success: false, error: err.message }),
  });

  const calls = (callHistory as any)?.data ?? [];
  const schema = tool.functionSchema ?? {};
  const schemaProperties = (schema as any)?.parameters?.properties ?? (schema as any)?.properties ?? {};
  const hasParameters = Object.keys(schemaProperties).length > 0;

  // Build test input template from schema parameters
  function generateInputTemplate() {
    const template: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schemaProperties)) {
      const prop = value as Record<string, unknown>;
      switch (prop.type) {
        case "string":
          template[key] = prop.example ?? prop.default ?? "";
          break;
        case "number":
        case "integer":
          template[key] = prop.example ?? prop.default ?? 0;
          break;
        case "boolean":
          template[key] = prop.example ?? prop.default ?? false;
          break;
        case "array":
          template[key] = prop.example ?? prop.default ?? [];
          break;
        case "object":
          template[key] = prop.example ?? prop.default ?? {};
          break;
        default:
          template[key] = null;
      }
    }
    return JSON.stringify(template, null, 2);
  }

  return (
    <Dialog open={open} onClose={onClose} title={tool.name} className="max-w-2xl">
      <div className="space-y-5">
        {/* Info */}
        <div className="flex items-center gap-2 flex-wrap">
          {typeIcon(tool.type)}
          <Badge variant={typeBadgeVariant(tool.type)}>{tool.type}</Badge>
          {tool.isApproved && <Badge variant="success">Approved</Badge>}
          {tool.isEnabled ? (
            <Badge variant="success">Enabled</Badge>
          ) : (
            <Badge variant="warning">Disabled</Badge>
          )}
        </div>

        {tool.description && <p className="text-sm text-text-secondary">{tool.description}</p>}

        {tool.endpoint && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Globe className="h-3.5 w-3.5" />
            <span className="font-mono">{tool.endpoint}</span>
          </div>
        )}

        {/* Parameters / Schema */}
        {hasParameters && (
          <div>
            <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5" /> Parameters
            </h3>
            <div className="space-y-1.5">
              {Object.entries(schemaProperties).map(([key, value]) => {
                const prop = value as Record<string, unknown>;
                const required = ((schema as any)?.required ?? []).includes(key);
                return (
                  <div
                    key={key}
                    className="flex items-start gap-3 p-2.5 rounded-lg bg-surface-secondary border border-border"
                  >
                    <code className="text-xs font-medium text-primary shrink-0">{key}</code>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-text-tertiary font-mono">
                          {String(prop.type ?? "any")}
                        </span>
                        {required && (
                          <span className="text-[10px] text-danger font-medium">required</span>
                        )}
                      </div>
                      {prop.description ? (
                        <p className="text-xs text-text-tertiary mt-0.5">
                          {String(prop.description)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Schema (raw) if no structured parameters */}
        {!hasParameters && Object.keys(schema).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-text mb-2">Schema</h3>
            <pre className="p-3 rounded-lg bg-surface-secondary border border-border text-xs text-text-secondary font-mono overflow-auto max-h-48">
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        )}

        {/* Usage Stats */}
        <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-text-tertiary" />
            <span className="text-xs text-text-secondary">
              {calls.length} call{calls.length !== 1 ? "s" : ""} recorded
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-text-tertiary" />
            <span className="text-xs text-text-secondary">
              Updated {new Date(tool.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Test Panel Toggle */}
        <div className="border-t border-border pt-4">
          <button
            onClick={() => {
              if (!showTestPanel && hasParameters) {
                setTestInput(generateInputTemplate());
              }
              setShowTestPanel((prev) => !prev);
              setTestResult(null);
            }}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            <Play className="h-4 w-4" />
            {showTestPanel ? "Hide Test Panel" : "Test This Tool"}
          </button>

          {showTestPanel && (
            <div className="mt-4 space-y-3">
              {/* Input fields */}
              {hasParameters ? (
                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    Input Parameters (JSON)
                  </label>
                  <p className="text-[10px] text-text-tertiary mb-2">
                    Pre-filled from schema. Edit values below and execute.
                  </p>
                  <textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    rows={Math.min(Object.keys(schemaProperties).length * 2 + 2, 10)}
                    className="w-full p-3 text-sm bg-surface border border-border rounded-lg text-text font-mono resize-y focus:outline-primary"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Input (JSON)</label>
                  <textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    rows={5}
                    className="w-full p-3 text-sm bg-surface border border-border rounded-lg text-text font-mono resize-y focus:outline-primary"
                  />
                </div>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={() => testTool.mutate({ id: tool.id, input: testInput })}
                loading={testTool.isPending}
              >
                <Play className="h-3.5 w-3.5" /> Execute Test
              </Button>

              {/* Result */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg border ${
                    testResult.success
                      ? "bg-success/5 border-success/20"
                      : "bg-danger/5 border-danger/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-danger" />
                    )}
                    <span className="text-xs font-medium text-text">
                      {testResult.success ? "Success" : "Failed"}
                      {testResult.latencyMs != null && ` (${testResult.latencyMs}ms)`}
                    </span>
                  </div>
                  <pre className="text-xs text-text-secondary overflow-auto max-h-40 font-mono">
                    {JSON.stringify(testResult.result ?? testResult.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
