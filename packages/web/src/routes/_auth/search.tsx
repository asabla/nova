import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, MessageSquare, Bot, BookOpen, FileText, Filter, Calendar, X } from "lucide-react";
import { api } from "../../lib/api";
import { Badge } from "../../components/ui/Badge";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/search")({
  component: SearchPage,
});

function highlightMatches(text: string, query: string): string {
  if (!query || query.length < 2) return escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  return escapeHtml(text).replace(regex, "<mark>$1</mark>");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [searchMode, setSearchMode] = useState("keyword");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery, type, dateFrom, dateTo, searchMode],
    queryFn: () => {
      const params = new URLSearchParams({ q: debouncedQuery });
      if (type !== "all") params.set("type", type);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (searchMode === "semantic") params.set("mode", "semantic");
      return api.get<any>(`/api/search?${params}`);
    },
    enabled: debouncedQuery.length >= 2,
  });

  const allResults = [
    ...(results?.conversations ?? []),
    ...(results?.messages ?? []),
    ...(results?.agents ?? []),
    ...(results?.knowledge ?? []),
    ...(results?.files ?? []),
  ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const typeIcon = (t: string) => {
    switch (t) {
      case "conversation": return <MessageSquare className="h-4 w-4 text-blue-400" />;
      case "message": return <MessageSquare className="h-4 w-4 text-text-tertiary" />;
      case "agent": return <Bot className="h-4 w-4 text-purple-400" />;
      case "knowledge": return <BookOpen className="h-4 w-4 text-green-400" />;
      case "file": return <FileText className="h-4 w-4 text-orange-400" />;
      default: return null;
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
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations, messages, agents, knowledge, files..."
          autoFocus
          className="w-full pl-12 pr-12 py-3 rounded-xl border border-border bg-surface text-text placeholder:text-text-tertiary text-sm focus:border-primary focus:outline-none"
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
            showFilters ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
            >
              <option value="all">All</option>
              <option value="conversations">Conversations</option>
              <option value="messages">Messages</option>
              <option value="agents">Agents</option>
              <option value="knowledge">Knowledge</option>
              <option value="files">Files</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Mode</label>
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value)}
              className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
            >
              <option value="keyword">Keyword</option>
              <option value="semantic">Semantic</option>
            </select>
          </div>
          {(dateFrom || dateTo || type !== "all" || searchMode !== "keyword") && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setType("all"); setSearchMode("keyword"); }}
              className="mt-4 p-1 text-text-tertiary hover:text-text-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {isLoading && debouncedQuery.length >= 2 && (
        <div className="text-center py-8 text-sm text-text-tertiary animate-pulse">
          Searching...
        </div>
      )}

      {results && (
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-xs text-text-tertiary px-1 pb-2">
            <span>{results.total ?? 0} results</span>
            {results.conversations?.length > 0 && <Badge variant="default">{results.conversations.length} conversations</Badge>}
            {results.messages?.length > 0 && <Badge variant="default">{results.messages.length} messages</Badge>}
            {results.agents?.length > 0 && <Badge variant="default">{results.agents.length} agents</Badge>}
            {results.knowledge?.length > 0 && <Badge variant="default">{results.knowledge.length} knowledge</Badge>}
            {results.files?.length > 0 && <Badge variant="default">{results.files.length} files</Badge>}
          </div>

          {allResults.map((result: any) => (
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
                  {result.snippet && (
                    <p
                      className="text-xs text-text-secondary mt-0.5 line-clamp-2 [&_mark]:bg-primary/20 [&_mark]:text-primary [&_mark]:rounded-sm [&_mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: highlightMatches(result.snippet, debouncedQuery) }}
                    />
                  )}
                  {result.description && !result.snippet && (
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{result.description}</p>
                  )}
                  {result.content && !result.snippet && (
                    <p
                      className="text-xs text-text-tertiary mt-0.5 line-clamp-1 [&_mark]:bg-primary/20 [&_mark]:text-primary [&_mark]:rounded-sm [&_mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: highlightMatches(result.content.slice(0, 150), debouncedQuery) }}
                    />
                  )}
                  {result.score != null && searchMode === "semantic" && (
                    <span className="text-[10px] text-text-tertiary">
                      Relevance: {(result.score * 100).toFixed(0)}%
                    </span>
                  )}
                  <span className="text-[10px] text-text-tertiary">
                    {result.createdAt && formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </button>
          ))}

          {allResults.length === 0 && debouncedQuery.length >= 2 && !isLoading && (
            <div className="text-center py-12">
              <Search className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-secondary">No results found for "{debouncedQuery}"</p>
              <p className="text-xs text-text-tertiary mt-1">Try different keywords or adjust filters</p>
            </div>
          )}
        </div>
      )}

      {!results && debouncedQuery.length < 2 && (
        <div className="text-center py-16">
          <Search className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-text-secondary">Search across everything in NOVA</p>
          <p className="text-xs text-text-tertiary mt-1">Conversations, messages, agents, knowledge, and files</p>
        </div>
      )}
    </div>
  );
}
