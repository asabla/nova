import { useState, useEffect } from "react";
import { Save, Layers, Trash2, ChevronDown } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { toast } from "../ui/Toast";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import type { KnowledgeCollection } from "./types";

interface SettingsTabProps {
  collectionId: string;
  collection: KnowledgeCollection;
  onDelete: () => void;
}

export function SettingsTab({ collectionId, collection, onDelete }: SettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    embeddingModel: "text-embedding-3-small",
    chunkSize: 512,
    chunkOverlap: 50,
  });

  useEffect(() => {
    setForm({
      name: collection.name ?? "",
      description: collection.description ?? "",
      embeddingModel: collection.embeddingModel ?? "text-embedding-3-small",
      chunkSize: collection.chunkSize ?? 512,
      chunkOverlap: collection.chunkOverlap ?? 50,
    });
  }, [collection]);

  const { data: embeddingModelsData } = useQuery({
    queryKey: [...queryKeys.knowledge.all, "embedding-models"],
    queryFn: () => api.get<{ data: { id: string; name: string }[] }>("/api/knowledge/models/embedding"),
  });

  const embeddingModels: { id: string; name: string }[] = (embeddingModelsData as any)?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const nameDescPromise = api.patch(`/api/knowledge/${collectionId}`, {
        name: data.name,
        description: data.description,
      });
      const configPromise = api.patch(`/api/knowledge/${collectionId}/config`, {
        embeddingModel: data.embeddingModel,
        chunkSize: data.chunkSize,
        chunkOverlap: data.chunkOverlap,
      });
      return Promise.all([nameDescPromise, configPromise]);
    },
    onSuccess: () => {
      toast.success(t("knowledge.updated", { defaultValue: "Collection updated" }));
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(collectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list() });
    },
    onError: (err: any) => toast.error(err.message ?? t("knowledge.updateFailed", { defaultValue: "Update failed" })),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <Input
        label={t("knowledge.name", { defaultValue: "Name" })}
        type="text"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <Textarea
        label={t("knowledge.description", { defaultValue: "Description" })}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder={t("knowledge.descriptionPlaceholder", { defaultValue: "What kind of documents does this collection contain?" })}
        rows={3}
      />

      {/* Advanced Configuration */}
      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        className="pt-2 border-t border-border"
      >
        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
          <ChevronDown className={`h-4 w-4 text-text-secondary transition-transform ${advancedOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <Layers className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            {t("knowledge.advancedConfig", { defaultValue: "Advanced Configuration" })}
          </h3>
        </summary>
        <p className="text-xs text-text-tertiary mt-1 mb-4 ml-6">
          {t("knowledge.advancedConfigHint", { defaultValue: "These settings affect how documents are processed. Changing them requires re-indexing." })}
        </p>
        <div className="space-y-4 ml-6">
          <Select
            label={t("knowledge.embeddingModel", { defaultValue: "Embedding Model" })}
            value={form.embeddingModel}
            onChange={(value) => setForm({ ...form, embeddingModel: value })}
            options={
              embeddingModels.length === 0
                ? [{ value: form.embeddingModel, label: form.embeddingModel }]
                : embeddingModels.map((m) => ({ value: m.id, label: m.name }))
            }
            helperText={t("knowledge.embeddingModelHint", { defaultValue: "Changing the model will require a full re-index of all documents." })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("knowledge.chunkSize", { defaultValue: "Chunk Size (tokens)" })}
              type="number"
              value={form.chunkSize}
              onChange={(e) => setForm({ ...form, chunkSize: Math.max(64, parseInt(e.target.value) || 512) })}
              min={64}
              max={8192}
              step={64}
            />
            <Input
              label={t("knowledge.chunkOverlap", { defaultValue: "Chunk Overlap (tokens)" })}
              type="number"
              value={form.chunkOverlap}
              onChange={(e) => setForm({ ...form, chunkOverlap: Math.max(0, parseInt(e.target.value) || 50) })}
              min={0}
              max={form.chunkSize / 2}
              step={10}
            />
          </div>
        </div>
      </details>

      {/* Save + metadata */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="text-xs text-text-tertiary space-y-1">
          <p>{t("common.created", { defaultValue: "Created" })}: {new Date(collection.createdAt).toLocaleDateString()}</p>
          <p>{t("common.updated", { defaultValue: "Updated" })}: {new Date(collection.updatedAt).toLocaleDateString()}</p>
          {collection.lastIndexedAt && <p>{t("knowledge.lastIndexed", { defaultValue: "Last indexed" })}: {new Date(collection.lastIndexedAt).toLocaleDateString()}</p>}
          <p>{t("knowledge.version", { defaultValue: "Version" })}: {collection.version}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => updateMutation.mutate(form)}
          disabled={updateMutation.isPending}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {updateMutation.isPending ? t("common.saving", { defaultValue: "Saving..." }) : t("knowledge.saveSettings", { defaultValue: "Save Settings" })}
        </Button>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-danger/30 p-4">
        <h3 className="text-sm font-semibold text-danger mb-1">{t("knowledge.dangerZone", { defaultValue: "Danger Zone" })}</h3>
        <p className="text-xs text-text-secondary mb-3">
          {t("knowledge.dangerZoneDesc", { defaultValue: "Permanently delete this collection and all its documents. This action cannot be undone." })}
        </p>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t("knowledge.deleteCollection", { defaultValue: "Delete Collection" })}
        </Button>
      </div>
    </div>
  );
}
