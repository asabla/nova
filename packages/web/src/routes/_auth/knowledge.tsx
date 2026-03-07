import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus, FileText, Upload, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { CardSkeleton } from "../../components/ui/Skeleton";

export const Route = createFileRoute("/_auth/knowledge")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: collectionsData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.knowledge.list(),
    queryFn: () => api.get<any>("/api/knowledge"),
  });

  const collections = (collectionsData as any)?.data ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">{t("knowledge.title", { defaultValue: "Knowledge Base" })}</h1>
            <p className="text-sm text-text-secondary mt-1">{t("knowledge.subtitle", { defaultValue: "Upload documents and build collections for RAG-powered conversations" })}</p>
          </div>
          <Button variant="primary" onClick={() => navigate({ to: "/knowledge", search: { action: "new" } as any })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("knowledge.newCollection", { defaultValue: "New Collection" })}
          </Button>
        </div>

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
            <Button variant="primary" onClick={() => navigate({ to: "/knowledge", search: { action: "new" } as any })}>
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
