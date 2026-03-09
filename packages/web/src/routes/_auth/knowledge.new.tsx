import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Button } from "../../components/ui/Button";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/knowledge/new")({
  component: NewKnowledgeCollectionPage,
});

function NewKnowledgeCollectionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post<any>("/api/knowledge", data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
      if (result?.id) {
        navigate({ to: `/knowledge/${result.id}`, replace: true });
      }
    },
    onError: () => {
      toast(t("knowledge.createError", { defaultValue: "Failed to create collection" }), "error");
    },
  });

  const handleCreate = useCallback(() => {
    if (!name.trim() || createMutation.isPending) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  }, [name, description, createMutation]);

  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-lg w-full">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">
            {t("knowledge.createTitle", { defaultValue: "Create Knowledge Collection" })}
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            {t("knowledge.createDescription", { defaultValue: "Organize documents into a collection for RAG-powered conversations." })}
          </p>

          {createMutation.isPending ? (
            <div className="flex items-center justify-center gap-2 py-4 text-text-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t("common.creating", { defaultValue: "Creating..." })}</span>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
              className="flex flex-col gap-4 text-left"
            >
              <Input
                label={t("knowledge.nameLabel", { defaultValue: "Name" })}
                placeholder={t("knowledge.namePlaceholder", { defaultValue: "e.g. Product Documentation" })}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                maxLength={200}
              />
              <Textarea
                label={t("knowledge.descriptionLabel", { defaultValue: "Description" })}
                rows={3}
                placeholder={t("knowledge.descriptionPlaceholder", { defaultValue: "Optional description of this collection" })}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                className="resize-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate({ to: "/knowledge" })}
                >
                  {t("common.cancel", { defaultValue: "Cancel" })}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!name.trim()}
                >
                  {t("common.create", { defaultValue: "Create" })}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
