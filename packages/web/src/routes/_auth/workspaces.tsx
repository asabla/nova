import { useState } from "react";
import { createFileRoute, useNavigate, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, Users, Lock, Globe, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import { CardSkeleton } from "../../components/ui/Skeleton";

export const Route = createFileRoute("/_auth/workspaces")({
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const matchRoute = useMatchRoute();
  const isChildRoute = matchRoute({ to: "/workspaces/$id", fuzzy: true });

  if (isChildRoute) {
    return <Outlet />;
  }

  return <WorkspacesListPage />;
}

function WorkspacesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");

  const { data: workspacesData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => api.get<any>("/api/workspaces"),
  });

  const workspaces = (workspacesData as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post<any>("/api/workspaces", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      toast.success(t("workspaces.created", { defaultValue: "Workspace created" }));
      setShowCreateDialog(false);
      setCreateName("");
      setCreateDescription("");
      navigate({ to: `/workspaces/${data.id}` });
    },
    onError: (err: any) => toast.error(err.message ?? t("workspaces.createFailed", { defaultValue: "Failed to create workspace" })),
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">{t("workspaces.title", { defaultValue: "Workspaces" })}</h1>
            <p className="text-sm text-text-secondary mt-1">{t("workspaces.subtitle", { defaultValue: "Organize conversations and collaborate with your team" })}</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("workspaces.newWorkspace", { defaultValue: "New Workspace" })}
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
            <p className="text-sm text-danger mb-4">{t("workspaces.loadError", { defaultValue: "Failed to load workspaces." })}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("common.retry", { defaultValue: "Retry" })}
            </Button>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <FolderKanban className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">{t("workspaces.emptyTitle", { defaultValue: "No workspaces yet" })}</h2>
            <p className="text-sm text-text-secondary max-w-sm mb-6">
              {t("workspaces.emptyDescription", { defaultValue: "Workspaces help you organize conversations by project or team. Members can share and collaborate." })}
            </p>
            <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("workspaces.createFirst", { defaultValue: "Create your first workspace" })}
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
                  <FolderKanban className="h-5 w-5 text-primary" aria-hidden="true" />
                  {ws.visibility === "private" ? (
                    <Lock className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                  ) : (
                    <Globe className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-text mb-1">{ws.name}</h3>
                <p className="text-xs text-text-tertiary mb-3">{ws.description ?? t("workspaces.noDescription", { defaultValue: "No description" })}</p>
                <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {ws.memberCount ?? 0} {t("workspaces.members", { defaultValue: "members" })}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} title={t("workspaces.createWorkspace", { defaultValue: "Create Workspace" })}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (createName.trim()) {
              createMutation.mutate({
                name: createName.trim(),
                description: createDescription.trim() || undefined,
              });
            }
          }}
          className="space-y-4"
        >
          <Input
            label={t("workspaces.name", { defaultValue: "Name" })}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder={t("workspaces.namePlaceholder", { defaultValue: "Workspace name" })}
            required
          />
          <Textarea
            label={t("workspaces.description", { defaultValue: "Description" })}
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
            placeholder={t("workspaces.descriptionPlaceholder", { defaultValue: "What is this workspace for?" })}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreateDialog(false)}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button variant="primary" type="submit" loading={createMutation.isPending}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("workspaces.create", { defaultValue: "Create" })}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
