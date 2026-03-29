import { createFileRoute, Link, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, Plus, Eye, EyeOff, ArrowUpRight, FileText } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/marketplace/agents")({
  component: MarketplaceAgentsPage,
});

function MarketplaceSubnav() {
  return (
    <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
      <Link
        to="/marketplace/agents"
        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2"
        style={{ borderColor: "var(--color-accent-blue)", color: "var(--color-accent-blue)" }}
      >
        <Bot className="h-4 w-4" /> Agents
      </Link>
      <Link
        to="/marketplace/templates"
        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent transition-colors"
        style={{ color: "var(--color-text-muted)" }}
      >
        <FileText className="h-4 w-4" /> Templates
      </Link>
    </div>
  );
}

function MarketplaceAgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-marketplace-agents"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/marketplace/agents"),
  });

  const agents = data?.data ?? [];
  const published = agents.filter((a: any) => a.isPublished);
  const drafts = agents.filter((a: any) => !a.isPublished);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Marketplace Agents</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Manage platform-curated agents visible to all organisations
          </p>
        </div>
      </div>

      <MarketplaceSubnav />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-xl skeleton" />)}
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <div className="inline-flex p-4 rounded-xl mb-4" style={{ background: "var(--color-accent-purple-dim)" }}>
            <Bot className="h-8 w-8" style={{ color: "var(--color-accent-purple)" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>No marketplace agents</h3>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--color-text-secondary)" }}>
            Create agents in the system organisation to populate the platform marketplace. Published agents will be available to all organisations.
          </p>
          <p className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
            Tip: Log into the main app as a system org member to create agents, then publish them here.
          </p>
        </div>
      ) : (
        <>
          {/* Published Agents */}
          {published.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider font-mono mb-3 flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
                <Eye className="h-3.5 w-3.5" style={{ color: "var(--color-accent-green)" }} />
                Published ({published.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {published.map((agent: any) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          )}

          {/* Draft Agents */}
          {drafts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider font-mono mb-3 flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
                <EyeOff className="h-3.5 w-3.5" />
                Drafts ({drafts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drafts.map((agent: any) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: any }) {
  return (
    <div
      className="rounded-xl border p-5 group transition-all duration-150 hover:border-opacity-60"
      style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2.5 rounded-lg" style={{ background: agent.isPublished ? "var(--color-accent-green-dim)" : "var(--color-surface-overlay)" }}>
          <Bot className="h-5 w-5" style={{ color: agent.isPublished ? "var(--color-accent-green)" : "var(--color-text-muted)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{agent.name}</h3>
          <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>v{agent.currentVersion ?? 1}</p>
        </div>
      </div>
      {agent.description && (
        <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--color-text-secondary)" }}>{agent.description}</p>
      )}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
          style={{
            background: agent.isPublished ? "var(--color-accent-green-dim)" : "var(--color-surface-overlay)",
            color: agent.isPublished ? "var(--color-accent-green)" : "var(--color-text-muted)",
          }}
        >
          {agent.isPublished ? "Published" : "Draft"}
        </span>
        <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
          {new Date(agent.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
