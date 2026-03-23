import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Bot, Plus, Star, RefreshCw, Search, MessageSquare, Store } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { getAgentColor, getAgentBgStyle, getAgentIconStyle } from "../../lib/agent-appearance";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type VisibilityFilter = "all" | "private" | "team" | "org" | "public";
type SortBy = "newest" | "name" | "usage";

const visibilityOptions: { id: VisibilityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "private", label: "Private" },
  { id: "team", label: "Team" },
  { id: "org", label: "Org" },
  { id: "public", label: "Public" },
];

export const Route = createFileRoute("/_auth/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const matchRoute = useMatchRoute();
  const isChildRoute = matchRoute({ to: "/agents/$id", fuzzy: true });

  if (isChildRoute) {
    return <Outlet />;
  }

  return <AgentsListPage />;
}

function AgentsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: agentsData, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.agents.list(), debouncedSearch],
    queryFn: () => api.get<any>(`/api/agents${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`),
    staleTime: 30_000,
  });

  const agents = useMemo(() => {
    let list: any[] = (agentsData as any)?.data ?? [];

    if (visibilityFilter !== "all") {
      list = list.filter((a: any) => a.visibility === visibilityFilter);
    }

    list = [...list].sort((a: any, b: any) => {
      if (sortBy === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sortBy === "usage") return (b.usageCount ?? 0) - (a.usageCount ?? 0);
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });

    return list;
  }, [agentsData, visibilityFilter, sortBy]);

  const handleChatWithAgent = (agent: any, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate({ to: "/conversations/new", search: { agentId: agent.id } });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">{t("agents.title", { defaultValue: "Agents" })}</h1>
            <p className="text-sm text-text-secondary mt-1">{t("agents.subtitle", { defaultValue: "Create and manage AI agents with custom instructions and tools" })}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate({ to: "/agents/marketplace" })}>
              <Store className="h-4 w-4" aria-hidden="true" />
              {t("agents.marketplace", { defaultValue: "Marketplace" })}
            </Button>
            <Button variant="primary" onClick={() => navigate({ to: "/agents/new" })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("agents.newAgent", { defaultValue: "New Agent" })}
            </Button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm input-glow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("agents.searchPlaceholder", { defaultValue: "Search agents..." })}
              aria-label={t("agents.searchLabel", { defaultValue: "Search your agents" })}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary"
            />
          </div>
          <div className="flex gap-1">
            {visibilityOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setVisibilityFilter(opt.id)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  visibilityFilter === opt.id
                    ? "bg-primary/10 text-primary"
                    : "text-text-tertiary hover:text-text hover:bg-surface-tertiary",
                )}
              >
                {t(`agents.visibility${opt.label}`, { defaultValue: opt.label })}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-9 px-2 text-xs rounded-lg border border-border bg-surface text-text-secondary"
            aria-label={t("agents.sortBy", { defaultValue: "Sort by" })}
          >
            <option value="newest">{t("agents.sortNewest", { defaultValue: "Newest" })}</option>
            <option value="name">{t("agents.sortName", { defaultValue: "Name" })}</option>
            <option value="usage">{t("agents.sortUsage", { defaultValue: "Most used" })}</option>
          </select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-danger mb-4">{t("agents.loadError", { defaultValue: "Failed to load agents." })}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("common.retry", { defaultValue: "Retry" })}
            </Button>
          </div>
        ) : agents.length === 0 ? (
          searchQuery || visibilityFilter !== "all" ? (
            <div className="text-center py-16">
              <Search className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-text-secondary">{t("agents.noResults", { defaultValue: "No agents matching your filters" })}</p>
              <button
                onClick={() => { setSearchQuery(""); setVisibilityFilter("all"); }}
                className="text-xs text-primary hover:text-primary-dark mt-2 underline"
              >
                {t("agents.clearFilters", { defaultValue: "Clear filters" })}
              </button>
            </div>
          ) : (
            <EmptyState />
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent: any) => (
              <AgentCard key={agent.id} agent={agent} onChat={handleChatWithAgent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent, onChat }: { agent: any; onChat: (agent: any, e: React.MouseEvent) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const color = getAgentColor(agent);
  return (
    <button
      onClick={() => navigate({ to: `/agents/${agent.id}` })}
      className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors cursor-pointer group text-left"
    >
      <div className="flex items-start justify-between mb-3 w-full">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={getAgentBgStyle(color)}>
          <Bot className="h-5 w-5" style={getAgentIconStyle(color)} aria-hidden="true" />
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={agent.visibility === "public" ? "primary" : "default"}>
            {agent.visibility}
          </Badge>
          <button
            onClick={(e) => onChat(agent, e)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all"
            title={t("agents.chatWith", { defaultValue: "Chat with agent" })}
            aria-label={t("agents.chatWith", { defaultValue: "Chat with agent" })}
          >
            <MessageSquare className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          </button>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-text mb-1">{agent.name}</h3>
      <p className="text-xs text-text-tertiary line-clamp-2 mb-3 flex-1">
        {agent.description ?? t("agents.noDescription", { defaultValue: "No description" })}
      </p>
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] text-text-tertiary">{agent.modelId ?? agent.model}</span>
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
          <span className="text-[10px] text-text-tertiary">{agent.usageCount ?? 0}</span>
        </div>
      </div>
    </button>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Bot className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-text mb-2">{t("agents.emptyTitle", { defaultValue: "No agents yet" })}</h2>
      <p className="text-sm text-text-secondary max-w-sm mb-6">
        {t("agents.emptyDescription", { defaultValue: "Agents are AI assistants with custom instructions, tools, and knowledge. Create one to get started." })}
      </p>
      <Button variant="primary" onClick={() => navigate({ to: "/agents/new" })}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("agents.createFirst", { defaultValue: "Create your first agent" })}
      </Button>
    </div>
  );
}
