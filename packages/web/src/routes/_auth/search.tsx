import { useState, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Search,
  MessageSquare,
  Bot,
  BookOpen,
  FileText,
  Filter,
  X,
  Sparkles,
  Loader2,
  FolderKanban,
  FlaskConical,
} from "lucide-react";
import { api } from "../../lib/api";
import { Badge } from "../../components/ui/Badge";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/search")({
  component: SearchPage,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightMatches(text: string, query: string): string {
  if (!query || query.length < 2) return escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  return escapeHtml(text).replace(regex, "<mark>$1</mark>");
}

type ResultType = "all" | "conversations" | "messages" | "agents" | "knowledge" | "files" | "workspaces" | "research";

const TABS: { id: ResultType; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: null },
  { id: "conversations", label: "Conversations", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { id: "messages", label: "Messages", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { id: "agents", label: "Agents", icon: <Bot className="h-3.5 w-3.5" /> },
  { id: "knowledge", label: "Knowledge", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "files", label: "Files", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "workspaces", label: "Workspaces", icon: <FolderKanban className="h-3.5 w-3.5" /> },
  { id: "research", label: "Research", icon: <FlaskConical className="h-3.5 w-3.5" /> },
];

// ─── Component ───────────────────────────────────────────────────────────────

function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ResultType>("all");
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [model, setModel] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [participants, setParticipants] = useState("");

  const hasFilters =
    dateFrom || dateTo || model || workspaceId || participants || searchMode !== "keyword";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch workspaces for filter dropdown
  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<any>("/api/workspaces"),
    staleTime: 60_000,
  });
  const workspaces = (workspacesData as any)?.data ?? [];

  // Main search query
  const { data: results, isLoading, isError } = useQuery({
    queryKey: [
      "search",
      debouncedQuery,
      activeTab,
      searchMode,
      dateFrom,
      dateTo,
      model,
      workspaceId,
      participants,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ q: debouncedQuery });
      if (activeTab !== "all") params.set("type", activeTab);
      if (searchMode === "semantic") params.set("mode", "semantic");
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (model) params.set("model", model);
      if (workspaceId) params.set("workspaceId", workspaceId);
      if (participants) params.set("participants", participants);
      return api.get<any>(`/api/search?${params}`);
    },
    enabled: debouncedQuery.length >= 2,
  });

  const clearFilters = useCallback(() => {
    setDateFrom("");
    setDateTo("");
    setModel("");
    setWorkspaceId("");
    setParticipants("");
    setSearchMode("keyword");
  }, []);

  // Combine results for "all" tab, or filter by active tab
  const getResultsForTab = (tab: ResultType) => {
    if (!results) return [];
    if (tab === "all") {
      return [
        ...(results.conversations ?? []),
        ...(results.messages ?? []),
        ...(results.agents ?? []),
        ...(results.knowledge ?? []),
        ...(results.files ?? []),
        ...(results.workspaces ?? []),
        ...(results.research ?? []),
      ].sort(
        (a: any, b: any) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() -
          new Date(a.updatedAt ?? a.createdAt).getTime(),
      );
    }
    return results[tab] ?? [];
  };

  const displayResults = getResultsForTab(activeTab);

  const tabCounts: Record<string, number> = {
    all: results?.total ?? 0,
    conversations: results?.conversations?.length ?? 0,
    messages: results?.messages?.length ?? 0,
    agents: results?.agents?.length ?? 0,
    knowledge: results?.knowledge?.length ?? 0,
    files: results?.files?.length ?? 0,
    workspaces: results?.workspaces?.length ?? 0,
    research: results?.research?.length ?? 0,
  };

  const typeIcon = (t: string) => {
    switch (t) {
      case "conversation":
        return <MessageSquare className="h-4 w-4 text-blue-400" />;
      case "message":
        return <MessageSquare className="h-4 w-4 text-text-tertiary" />;
      case "agent":
        return <Bot className="h-4 w-4 text-purple-400" />;
      case "knowledge":
        return <BookOpen className="h-4 w-4 text-green-400" />;
      case "file":
        return <FileText className="h-4 w-4 text-orange-400" />;
      case "workspace":
        return <FolderKanban className="h-4 w-4 text-amber-400" />;
      case "research":
        return <FlaskConical className="h-4 w-4 text-rose-400" />;
      default:
        return null;
    }
  };

  const handleResultClick = (result: any) => {
    switch (result.type) {
      case "conversation":
        navigate({ to: `/conversations/${result.id}` });
        break;
      case "message":
        navigate({ to: `/conversations/${result.conversationId}` });
        break;
      case "agent":
        navigate({ to: `/agents/${result.id}` });
        break;
      case "knowledge":
        navigate({ to: `/knowledge/${result.id}` });
        break;
      case "workspace":
        navigate({ to: `/workspaces/${result.id}` });
        break;
      case "research":
        navigate({ to: "/research" });
        break;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Search className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-bold text-text">{t("search.title", "Search")}</h1>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              "search.placeholder",
              "Search conversations, messages, agents, knowledge, files...",
            )}
            autoFocus
            className="w-full pl-12 pr-24 py-3 rounded-xl border border-border bg-surface text-text placeholder:text-text-tertiary text-sm focus:border-primary focus:outline-none"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Semantic toggle */}
            <button
              onClick={() =>
                setSearchMode((m) => (m === "keyword" ? "semantic" : "keyword"))
              }
              title={
                searchMode === "semantic"
                  ? t("search.mode.semantic", "Semantic search")
                  : t("search.mode.keyword", "Keyword search")
              }
              aria-label={
                searchMode === "semantic"
                  ? t("search.mode.semantic", "Semantic search")
                  : t("search.mode.keyword", "Keyword search")
              }
              className={`p-1.5 rounded-lg transition-colors ${
                searchMode === "semantic"
                  ? "bg-primary/10 text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </button>
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-label={t("search.toggleFilters", "Toggle filters")}
              className={`p-1.5 rounded-lg transition-colors ${
                showFilters || hasFilters
                  ? "bg-primary/10 text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-surface-secondary border border-border">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">
                {t("search.filter.from", "From")}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">
                {t("search.filter.to", "To")}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">
                {t("search.filter.model", "Model")}
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gpt-4"
                className="h-8 w-32 px-2 text-xs bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">
                {t("search.filter.workspace", "Workspace")}
              </label>
              <select
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
              >
                <option value="">{t("search.filter.allWorkspaces", "All workspaces")}</option>
                {workspaces.map((ws: any) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">
                {t("search.filter.participants", "Participants")}
              </label>
              <input
                type="text"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="user-id-1,user-id-2"
                className="h-8 w-48 px-2 text-xs bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary"
              />
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="h-8 px-2 text-xs text-text-tertiary hover:text-text-secondary flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                {t("search.filter.clear", "Clear")}
              </button>
            )}
          </div>
        )}

        {/* Result Type Tabs */}
        {results && (
          <div className="flex gap-1 overflow-x-auto border-b border-border">
            {TABS.map((tab) => {
              const count = tabCounts[tab.id] ?? 0;
              if (tab.id !== "all" && count === 0) return null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-text-secondary hover:text-text"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {count > 0 && (
                    <span className="text-[10px] text-text-tertiary ml-0.5">({count})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {isError && debouncedQuery.length >= 2 && (
          <div className="text-center py-12">
            <Search className="h-8 w-8 text-danger mx-auto mb-3 opacity-60" aria-hidden="true" />
            <p className="text-sm text-danger">{t("search.error", "Search failed")}</p>
            <p className="text-xs text-text-tertiary mt-1">{t("common.tryAgain", "Please try again later.")}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && debouncedQuery.length >= 2 && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("search.searching", "Searching...")}
          </div>
        )}

        {/* Results List */}
        {results && !isLoading && (
          <div className="space-y-1">
            {searchMode === "semantic" && (
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                <span className="text-[10px] text-primary font-medium">
                  {t("search.semanticMode", "Semantic search")}
                </span>
              </div>
            )}

            {displayResults.map((result: any) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="w-full text-left p-3 rounded-xl hover:bg-surface-secondary border border-transparent hover:border-border transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{typeIcon(result.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text group-hover:text-primary transition-colors truncate">
                        {result.title ?? result.name ?? result.filename ?? "Untitled"}
                      </span>
                      <Badge variant="default">{result.type}</Badge>
                    </div>

                    {/* Snippet with highlighted matches */}
                    {result.snippet && (
                      <p
                        className="text-xs text-text-secondary mt-1 line-clamp-2 [&_mark]:bg-primary/20 [&_mark]:text-primary [&_mark]:rounded-sm [&_mark]:px-0.5"
                        dangerouslySetInnerHTML={{
                          __html: highlightMatches(result.snippet, debouncedQuery),
                        }}
                      />
                    )}
                    {result.description && !result.snippet && (
                      <p
                        className="text-xs text-text-secondary mt-1 line-clamp-2 [&_mark]:bg-primary/20 [&_mark]:text-primary [&_mark]:rounded-sm [&_mark]:px-0.5"
                        dangerouslySetInnerHTML={{
                          __html: highlightMatches(
                            result.description.slice(0, 200),
                            debouncedQuery,
                          ),
                        }}
                      />
                    )}
                    {result.content && !result.snippet && !result.description && (
                      <p
                        className="text-xs text-text-tertiary mt-1 line-clamp-2 [&_mark]:bg-primary/20 [&_mark]:text-primary [&_mark]:rounded-sm [&_mark]:px-0.5"
                        dangerouslySetInnerHTML={{
                          __html: highlightMatches(result.content.slice(0, 200), debouncedQuery),
                        }}
                      />
                    )}

                    {/* Metadata row */}
                    <div className="flex items-center gap-2 mt-1">
                      {result.score != null && searchMode === "semantic" && (
                        <span className="text-[10px] text-primary/70">
                          {(result.score * 100).toFixed(0)}% match
                        </span>
                      )}
                      {result.workspaceId && (
                        <span className="text-[10px] text-text-tertiary">
                          {workspaces.find((w: any) => w.id === result.workspaceId)?.name ??
                            "Workspace"}
                        </span>
                      )}
                      {result.senderType && (
                        <Badge variant="default">{result.senderType}</Badge>
                      )}
                      <span className="text-[10px] text-text-tertiary">
                        {result.createdAt &&
                          formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {/* No results */}
            {displayResults.length === 0 && debouncedQuery.length >= 2 && (
              <div className="text-center py-12">
                <Search className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-text-secondary">
                  {t("search.noResults", 'No results found for "{{query}}"', {
                    query: debouncedQuery,
                  })}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {t("search.noResultsHint", "Try different keywords or adjust filters")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!results && debouncedQuery.length < 2 && !isLoading && (
          <div className="text-center py-16">
            <Search className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-text-secondary">
              {t("search.emptyTitle", "Search across everything in NOVA")}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              {t(
                "search.emptyDescription",
                "Conversations, messages, agents, knowledge, and files",
              )}
            </p>
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-text-tertiary">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {t("search.tip.semantic", "Use semantic mode for meaning-based search")}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
