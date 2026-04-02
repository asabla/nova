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
  FlaskConical,
} from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Tabs } from "../../components/ui/Tabs";
import { formatRelativeTime } from "../../lib/format";

export const Route = createFileRoute("/_auth/search")({
  component: SearchPage,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-primary rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

type ResultType = "all" | "conversations" | "messages" | "agents" | "knowledge" | "files" | "research";

const TABS: { id: ResultType; labelKey: string; labelDefault: string; icon: React.ReactNode }[] = [
  { id: "all", labelKey: "search.tab.all", labelDefault: "All", icon: null },
  { id: "conversations", labelKey: "search.tab.conversations", labelDefault: "Conversations", icon: <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> },
  { id: "messages", labelKey: "search.tab.messages", labelDefault: "Messages", icon: <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> },
  { id: "agents", labelKey: "search.tab.agents", labelDefault: "Agents", icon: <Bot className="h-3.5 w-3.5" aria-hidden="true" /> },
  { id: "knowledge", labelKey: "search.tab.knowledge", labelDefault: "Knowledge", icon: <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> },
  { id: "files", labelKey: "search.tab.files", labelDefault: "Files", icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" /> },
  { id: "research", labelKey: "search.tab.research", labelDefault: "Research", icon: <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" /> },
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
  const [participants, setParticipants] = useState("");

  const hasFilters =
    dateFrom || dateTo || model || participants || searchMode !== "keyword";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

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
      participants,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ q: debouncedQuery });
      if (activeTab !== "all") params.set("type", activeTab);
      if (searchMode === "semantic") params.set("mode", "semantic");
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (model) params.set("model", model);
      if (participants) params.set("participants", participants);
      return api.get<any>(`/api/search?${params}`);
    },
    enabled: debouncedQuery.length >= 2,
  });

  const clearFilters = useCallback(() => {
    setDateFrom("");
    setDateTo("");
    setModel("");
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
        ...(results.research ?? []),
      ].sort(
        (a: any, b: any) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() -
          new Date(a.updatedAt ?? a.createdAt).getTime(),
      );
    }
    return results[tab] ?? [];
  };

  const tabCounts: Record<string, number> = {
    all: results?.total ?? 0,
    conversations: results?.conversations?.length ?? 0,
    messages: results?.messages?.length ?? 0,
    agents: results?.agents?.length ?? 0,
    knowledge: results?.knowledge?.length ?? 0,
    files: results?.files?.length ?? 0,
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
      case "research":
        navigate({ to: "/research", search: { report: undefined } });
        break;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Search className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-bold text-text">{t("search.title", "Search")}</h1>
        </div>

        {/* Search Input */}
        <div className="relative input-glow">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-text-tertiary" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              "search.placeholder",
              "Search conversations, messages, agents, knowledge, files...",
            )}
            aria-label={t("search.placeholder", "Search conversations, messages, agents, knowledge, files...")}
            autoFocus
            className="w-full pl-10 sm:pl-12 pr-16 sm:pr-24 py-2.5 sm:py-3 rounded-xl border border-border bg-surface text-text placeholder:text-text-tertiary text-sm focus:border-primary focus:outline-none"
          />
          <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1">
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
          <div className="flex flex-wrap items-end gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-surface-secondary border border-border">
            <Input
              type="date"
              label={t("search.filter.from", "From")}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 px-2 text-xs"
            />
            <Input
              type="date"
              label={t("search.filter.to", "To")}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 px-2 text-xs"
            />
            <Input
              type="text"
              label={t("search.filter.model", "Model")}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. gpt-4"
              className="h-8 w-full sm:w-32 px-2 text-xs"
            />
            <Input
              type="text"
              label={t("search.filter.participants", "Participants")}
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="user-id-1,user-id-2"
              className="h-8 w-full sm:w-48 px-2 text-xs"
            />
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

        {/* Result Type Tabs + Content */}
        {results && (
          <Tabs
            tabs={TABS
              .filter((tab) => tab.id === "all" || (tabCounts[tab.id] ?? 0) > 0)
              .map((tab) => {
                const count = tabCounts[tab.id] ?? 0;
                return {
                  id: tab.id,
                  label: `${t(tab.labelKey, tab.labelDefault)}${count > 0 ? ` (${count})` : ""}`,
                  icon: tab.icon ?? undefined,
                };
              })}
            activeTab={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId as ResultType)}
          >
            {(currentTab) => {
              const tabResults = getResultsForTab(currentTab as ResultType);
              return (
                <div>
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
                  {!isLoading && (
                    <div className="space-y-0.5 sm:space-y-1">
                      {searchMode === "semantic" && (
                        <div className="flex items-center gap-1.5 px-1 pb-1">
                          <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                          <span className="text-[10px] text-primary font-medium">
                            {t("search.semanticMode", "Semantic search")}
                          </span>
                        </div>
                      )}

                      {tabResults.map((result: any) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className="w-full text-left p-2.5 sm:p-3 rounded-xl hover:bg-surface-secondary border border-transparent hover:border-border transition-all group"
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
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
                                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                                  <HighlightedText text={result.snippet} query={debouncedQuery} />
                                </p>
                              )}
                              {result.description && !result.snippet && (
                                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                                  <HighlightedText text={result.description.slice(0, 200)} query={debouncedQuery} />
                                </p>
                              )}
                              {result.content && !result.snippet && !result.description && (
                                <p className="text-xs text-text-tertiary mt-1 line-clamp-2">
                                  <HighlightedText text={result.content.slice(0, 200)} query={debouncedQuery} />
                                </p>
                              )}

                              {/* Metadata row */}
                              <div className="flex items-center gap-2 mt-1">
                                {result.score != null && searchMode === "semantic" && (
                                  <span className="text-[10px] text-primary/70">
                                    {(result.score * 100).toFixed(0)}% match
                                  </span>
                                )}
                                {result.senderType && (
                                  <Badge variant="default">{result.senderType}</Badge>
                                )}
                                <span className="text-[10px] text-text-tertiary">
                                  {result.createdAt && formatRelativeTime(result.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}

                      {/* No results */}
                      {tabResults.length === 0 && debouncedQuery.length >= 2 && (
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
                </div>
              );
            }}
          </Tabs>
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
            <div className="flex items-center justify-center gap-2 sm:gap-4 mt-3 sm:mt-4 text-[10px] text-text-tertiary">
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
