import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Plus, Users, Lock, Globe } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

export const Route = createFileRoute("/_auth/workspaces")({
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: workspacesData } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => api.get<any>("/api/workspaces"),
  });

  const workspaces = (workspacesData as any)?.data ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Workspaces</h1>
            <p className="text-sm text-text-secondary mt-1">Organize conversations and collaborate with your team</p>
          </div>
          <Button variant="primary" onClick={() => navigate({ to: "/workspaces", search: { action: "new" } as any })}>
            <Plus className="h-4 w-4" />
            New Workspace
          </Button>
        </div>

        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <FolderKanban className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">No workspaces yet</h2>
            <p className="text-sm text-text-secondary max-w-sm mb-6">
              Workspaces help you organize conversations by project or team. Members can share and collaborate.
            </p>
            <Button variant="primary" onClick={() => navigate({ to: "/workspaces", search: { action: "new" } as any })}>
              <Plus className="h-4 w-4" />
              Create your first workspace
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws: any) => (
              <button
                key={ws.id}
                onClick={() => navigate({ to: `/workspaces/${ws.id}` })}
                className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors cursor-pointer text-left"
              >
                <div className="flex items-start justify-between mb-3 w-full">
                  <FolderKanban className="h-5 w-5 text-primary" />
                  {ws.visibility === "private" ? (
                    <Lock className="h-3.5 w-3.5 text-text-tertiary" />
                  ) : (
                    <Globe className="h-3.5 w-3.5 text-text-tertiary" />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-text mb-1">{ws.name}</h3>
                <p className="text-xs text-text-tertiary mb-3">{ws.description ?? "No description"}</p>
                <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
                  <Users className="h-3 w-3" />
                  {ws.memberCount ?? 0} members
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
