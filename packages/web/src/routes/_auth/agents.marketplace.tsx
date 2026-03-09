import { useState, useEffect, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bot, Search, Plus, Zap, Copy, ArrowRight, RefreshCw,
  Code2, Palette, BarChart3, BookOpen, Shield, Sparkles,
  Star, Download, ChevronLeft, ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { toast } from "../../components/ui/Toast";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type Category = "all" | "coding" | "creative" | "analysis" | "research" | "productivity" | "security";

const categories: { id: Category; label: string; icon: typeof Bot }[] = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "coding", label: "Coding", icon: Code2 },
  { id: "analysis", label: "Analysis", icon: BarChart3 },
  { id: "creative", label: "Creative", icon: Palette },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "productivity", label: "Productivity", icon: Zap },
  { id: "security", label: "Security", icon: Shield },
];

function formatDownloads(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export const Route = createFileRoute("/_auth/agents/marketplace")({
  component: AgentMarketplacePage,
});

function AgentMarketplacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [page, setPage] = useState(1);
  const perPage = 6;
  const debouncedSearch = useDebounce(search, 300);

  const { data: agents, isLoading, isError, refetch } = useQuery({
    queryKey: ["agents-marketplace", debouncedSearch],
    queryFn: () => api.get<any>(`/api/agents/marketplace/browse?search=${debouncedSearch}`),
    staleTime: 30_000,
  });

  const cloneAgent = useMutation({
    mutationFn: (agentId: string) => api.post<any>(`/api/agents/${agentId}/clone`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast(t("marketplace.cloneSuccess", "Agent cloned to your library"), "success");
      navigate({ to: `/agents/${data.id}` });
    },
    onError: () => {
      toast(t("marketplace.cloneError", "Failed to clone agent"), "error");
    },
  });

  const agentList: any[] = (agents as any)?.data ?? [];

  const filtered = useMemo(() => {
    return agentList.filter((a: any) => {
      if (category !== "all" && a.category && a.category !== category) return false;
      return true;
    });
  }, [agentList, category]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">{t("marketplace.title", "Agent Marketplace")}</h1>
            <p className="text-sm text-text-secondary mt-1">
              {t("marketplace.description", "Discover and install specialized agents for your workflows")}
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate({ to: "/agents" })}>
            <Bot className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {t("marketplace.myAgents", "My Agents")}
          </Button>
        </div>

        {/* Search + Category Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t("marketplace.searchPlaceholder", "Search agents...")}
              aria-label={t("marketplace.searchLabel", "Search marketplace agents")}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary focus:outline-2 focus:outline-primary"
            />
          </div>
          <div className="flex gap-1">
            {categories.map((cat) => {
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setCategory(cat.id); setPage(1); }}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    category === cat.id
                      ? "bg-primary/10 text-primary"
                      : "text-text-tertiary hover:text-text hover:bg-surface-tertiary",
                  )}
                >
                  <CatIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t(`marketplace.category.${cat.id}`, cat.label)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-text-tertiary mb-3">
          {filtered.length} {t("marketplace.agentCount", { count: filtered.length, defaultValue: `agent${filtered.length !== 1 ? "s" : ""} found` })}
        </p>

        {/* Agents Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-sm text-text-tertiary animate-pulse">{t("marketplace.loading", "Loading agents...")}</p>
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <Bot className="h-10 w-10 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-text-secondary">{t("marketplace.loadError", "Failed to load agents")}</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("common.retry", "Retry")}
            </Button>
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16">
            <Bot className="h-10 w-10 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-text-secondary">{t("marketplace.noAgents", "No published agents yet")}</p>
            <p className="text-xs text-text-tertiary mt-1">
              {search ? t("marketplace.tryDifferent", "Try a different search term") : t("marketplace.publishHint", "Publish an agent to make it available here")}
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => navigate({ to: "/agents/new" })}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t("marketplace.createAgent", "Create Agent")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {paginated.map((agent: any) => (
              <div
                key={agent.id}
                className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-all cursor-pointer group"
                onClick={() => navigate({ to: `/agents/${agent.id}` })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate({ to: `/agents/${agent.id}` })}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text truncate">{agent.name}</h3>
                      {agent.featured && <Badge variant="primary">{t("marketplace.featured", "Featured")}</Badge>}
                    </div>
                    <p className="text-[10px] text-text-tertiary">
                      {agent.author ? `by ${agent.author}` : `v${agent.currentVersion ?? "1.0"}`}
                    </p>
                  </div>
                </div>

                {agent.description && (
                  <p className="text-xs text-text-secondary mb-3 line-clamp-2 flex-1">
                    {agent.description}
                  </p>
                )}

                {/* Tags */}
                {agent.tags && agent.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {agent.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-tertiary text-text-tertiary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-auto pt-2 border-t border-border">
                  {typeof agent.rating === "number" && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-warning fill-warning" aria-hidden="true" />
                      <span className="text-[11px] font-medium text-text">{agent.rating}</span>
                    </div>
                  )}
                  {typeof agent.downloads === "number" && (
                    <div className="flex items-center gap-1">
                      <Download className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
                      <span className="text-[11px] text-text-tertiary">{formatDownloads(agent.downloads)}</span>
                    </div>
                  )}
                  {agent.isEnabled && <Badge variant="success">{t("marketplace.active", "Active")}</Badge>}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      cloneAgent.mutate(agent.id);
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" aria-hidden="true" />
                    {t("marketplace.install", "Install")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-border text-text-tertiary hover:text-text disabled:opacity-30 transition-colors"
              aria-label={t("common.previous", "Previous page")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={clsx(
                  "h-8 w-8 rounded-lg text-xs font-medium transition-colors",
                  p === page ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-surface-tertiary",
                )}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-border text-text-tertiary hover:text-text disabled:opacity-30 transition-colors"
              aria-label={t("common.next", "Next page")}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
