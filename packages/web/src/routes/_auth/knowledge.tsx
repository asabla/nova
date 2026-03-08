import { createFileRoute, useNavigate, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, FileText, Upload, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";

export const Route = createFileRoute("/_auth/knowledge")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const matchRoute = useMatchRoute();
  const isChildRoute = matchRoute({ to: "/knowledge/$id", fuzzy: true });

  if (isChildRoute) {
    return <Outlet />;
  }

  return <KnowledgeListPage />;
}

function KnowledgeListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data: collectionsData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.knowledge.list(),
    queryFn: () => api.get<any>("/api/knowledge"),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post<any>("/api/knowledge", data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
      setShowCreateDialog(false);
      setNewName("");
      setNewDescription("");
      if (result?.id) {
        navigate({ to: `/knowledge/${result.id}` });
      }
    },
  });

  const collections = (collectionsData as any)?.data ?? [];

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">{t("knowledge.title", { defaultValue: "Knowledge Base" })}</h1>
            <p className="text-sm text-text-secondary mt-1">{t("knowledge.subtitle", { defaultValue: "Upload documents and build collections for RAG-powered conversations" })}</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("knowledge.newCollection", { defaultValue: "New Collection" })}
          </Button>
        </div>

        <Dialog
          open={showCreateDialog}
          onClose={() => { setShowCreateDialog(false); setNewName(""); setNewDescription(""); createMutation.reset(); }}
          title={t("knowledge.createTitle", { defaultValue: "Create Knowledge Collection" })}
          size="sm"
        >
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
            className="flex flex-col gap-4"
          >
            <Input
              label={t("knowledge.nameLabel", { defaultValue: "Name" })}
              placeholder={t("knowledge.namePlaceholder", { defaultValue: "e.g. Product Documentation" })}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
              maxLength={200}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">
                {t("knowledge.descriptionLabel", { defaultValue: "Description" })}
              </label>
              <textarea
                className="rounded-lg border border-border hover:border-border-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-text-tertiary transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary focus-visible:border-primary resize-none"
                rows={3}
                placeholder={t("knowledge.descriptionPlaceholder", { defaultValue: "Optional description of this collection" })}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                maxLength={2000}
              />
            </div>
            {createMutation.isError && (
              <p className="text-xs text-danger" role="alert">
                {t("knowledge.createError", { defaultValue: "Failed to create collection. Please try again." })}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setShowCreateDialog(false); setNewName(""); setNewDescription(""); createMutation.reset(); }}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!newName.trim() || createMutation.isPending}
              >
                {createMutation.isPending
                  ? t("common.creating", { defaultValue: "Creating..." })
                  : t("common.create", { defaultValue: "Create" })}
              </Button>
            </div>
          </form>
        </Dialog>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-danger mb-4">{t("knowledge.loadError", { defaultValue: "Failed to load knowledge collections." })}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("common.retry", { defaultValue: "Retry" })}
            </Button>
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">{t("knowledge.emptyTitle", { defaultValue: "No knowledge collections" })}</h2>
            <p className="text-sm text-text-secondary max-w-sm mb-6">
              {t("knowledge.emptyDescription", { defaultValue: "Upload documents and organize them into collections. Agents can use these for context-aware answers." })}
            </p>
            <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {t("knowledge.uploadDocuments", { defaultValue: "Upload Documents" })}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {collections.map((col: any) => (
              <button
                key={col.id}
                onClick={() => navigate({ to: `/knowledge/${col.id}` })}
                className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors cursor-pointer text-left"
              >
                <div className="flex items-start justify-between mb-3 w-full">
                  <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
                  <Badge variant={col.status === "ready" ? "success" : "warning"}>
                    {col.status}
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold text-text mb-1">{col.name}</h3>
                <p className="text-xs text-text-tertiary mb-3">{col.description ?? t("knowledge.noDescription", { defaultValue: "No description" })}</p>
                <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    {col.documentCount ?? 0} {t("knowledge.docs", { defaultValue: "docs" })}
                  </span>
                  <span>{col.chunkCount ?? 0} {t("knowledge.chunks", { defaultValue: "chunks" })}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
