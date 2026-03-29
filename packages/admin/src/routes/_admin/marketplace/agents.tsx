import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/marketplace/agents")({
  component: MarketplaceAgentsPage,
});

function MarketplaceAgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-marketplace-agents"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/marketplace/agents"),
  });

  const agents = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Marketplace Agents</h1>
        <p className="text-sm text-gray-500 mt-1">Manage platform-curated agents in the system org</p>
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm animate-pulse">Loading...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16">
          <Bot className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No agents in the system org yet</p>
          <p className="text-xs text-gray-600 mt-1">Create agents in the system org to populate the platform marketplace</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => (
            <div key={agent.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-5 w-5 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
              </div>
              {agent.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{agent.description}</p>}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${agent.isPublished ? "bg-green-500/10 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                  {agent.isPublished ? "Published" : "Draft"}
                </span>
                <span className="text-[10px] text-gray-600">v{agent.currentVersion ?? 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
