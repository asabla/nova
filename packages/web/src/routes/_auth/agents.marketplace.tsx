import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Search, Plus, Star, Users, Zap, Copy, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/agents/marketplace")({
  component: AgentMarketplacePage,
});

function AgentMarketplacePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents-marketplace", search],
    queryFn: () => api.get<any>(`/api/agents/marketplace/browse?search=${search}`),
  });

  const cloneAgent = useMutation({
    mutationFn: (agentId: string) => api.post<any>(`/api/agents/${agentId}/clone`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast("Agent cloned to your library", "success");
      navigate({ to: `/agents/${data.id}` });
    },
  });

  const agentList = (agents as any)?.data ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
              <Bot className="h-7 w-7 text-purple-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-text mb-2">Agent Marketplace</h1>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Browse published agents from your organization. Clone any agent to customize it for your needs.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary focus:outline-primary"
          />
        </div>

        {/* Agents Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-sm text-text-tertiary animate-pulse">Loading agents...</p>
          </div>
        ) : agentList.length === 0 ? (
          <div className="text-center py-16">
            <Bot className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No published agents yet</p>
            <p className="text-xs text-text-tertiary mt-1">
              {search ? "Try a different search term" : "Publish an agent to make it available here"}
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => navigate({ to: "/agents/new" })}>
              <Plus className="h-4 w-4" /> Create Agent
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentList.map((agent: any) => (
              <div
                key={agent.id}
                className="flex flex-col p-5 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="default">{agent.visibility}</Badge>
                    {agent.isEnabled && <Badge variant="success">Active</Badge>}
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-text mb-1">{agent.name}</h3>
                {agent.description && (
                  <p className="text-xs text-text-tertiary leading-relaxed mb-3 line-clamp-2 flex-1">
                    {agent.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[10px] text-text-tertiary mb-4">
                  {agent.toolApprovalMode && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" /> {agent.toolApprovalMode}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> v{agent.currentVersion}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate({ to: `/agents/${agent.id}` })}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => cloneAgent.mutate(agent.id)}
                    className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text ml-auto"
                  >
                    <Copy className="h-3 w-3" /> Clone
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
