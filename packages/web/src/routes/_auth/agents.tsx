import { createFileRoute, Link, useNavigate, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Bot, Plus, Star, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { CardSkeleton } from "../../components/ui/Skeleton";

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

  const { data: agentsData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.agents.list(),
    queryFn: () => api.get<any>("/api/agents"),
    staleTime: 30_000,
  });

  const agents = (agentsData as any)?.data ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">{t("agents.title", { defaultValue: "Agents" })}</h1>
            <p className="text-sm text-text-secondary mt-1">{t("agents.subtitle", { defaultValue: "Create and manage AI agents with custom instructions and tools" })}</p>
          </div>
          <Button variant="primary" onClick={() => navigate({ to: "/agents/new" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("agents.newAgent", { defaultValue: "New Agent" })}
          </Button>
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
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent: any) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: any }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to: `/agents/${agent.id}` })}
      className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors cursor-pointer group text-left"
    >
      <div className="flex items-start justify-between mb-3 w-full">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <Badge variant={agent.status === "active" ? "success" : "default"}>
          {agent.status}
        </Badge>
      </div>
      <h3 className="text-sm font-semibold text-text mb-1">{agent.name}</h3>
      <p className="text-xs text-text-tertiary line-clamp-2 mb-3 flex-1">
        {agent.description ?? t("agents.noDescription", { defaultValue: "No description" })}
      </p>
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] text-text-tertiary">{agent.model}</span>
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
