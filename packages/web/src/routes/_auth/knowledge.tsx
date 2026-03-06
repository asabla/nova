import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus, FileText, Upload } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

export const Route = createFileRoute("/_auth/knowledge")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const { t } = useTranslation();

  const { data: collectionsData } = useQuery({
    queryKey: queryKeys.knowledge.list(),
    queryFn: () => api.get<any>("/api/knowledge"),
  });

  const collections = (collectionsData as any)?.data ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Knowledge Base</h1>
            <p className="text-sm text-text-secondary mt-1">Upload documents and build collections for RAG-powered conversations</p>
          </div>
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Collection
          </Button>
        </div>

        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">No knowledge collections</h2>
            <p className="text-sm text-text-secondary max-w-sm mb-6">
              Upload documents and organize them into collections. Agents can use these for context-aware answers.
            </p>
            <Button variant="primary">
              <Upload className="h-4 w-4" />
              Upload Documents
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {collections.map((col: any) => (
              <div key={col.id} className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <Badge variant={col.status === "ready" ? "success" : "warning"}>
                    {col.status}
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold text-text mb-1">{col.name}</h3>
                <p className="text-xs text-text-tertiary mb-3">{col.description ?? "No description"}</p>
                <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {col.documentCount ?? 0} docs
                  </span>
                  <span>{col.chunkCount ?? 0} chunks</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
