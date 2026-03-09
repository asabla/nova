import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Cpu,
  Plus,
  ToggleLeft,
  ToggleRight,
  Star,
  GripVertical,
  Activity,
  Clock,
  AlertTriangle,
  Hash,
  ChevronDown,
  ChevronUp,
  Shield,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { ModelCapabilityBadges } from "../../components/ui/ModelCapabilityBadges";
import { Dialog } from "../../components/ui/Dialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/models")({
  component: ModelsPage,
});

function ModelsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [fallbackExpanded, setFallbackExpanded] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ["admin-models"],
    queryFn: () => api.get<any>("/api/models/all"),
  });

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ["model-providers"],
    queryFn: () => api.get<any>("/api/models/providers"),
  });

  const { data: statsData } = useQuery({
    queryKey: ["model-stats"],
    queryFn: () => api.get<any>("/api/analytics/models").catch(() => ({ data: [] })),
    refetchInterval: 30_000,
  });

  const toggleModel = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/models/${id}`, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-models"] }),
    onError: (err: any) => toast(err.message ?? t("admin.toggleModelFailed", { defaultValue: "Failed to toggle model" }), "error"),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.patch(`/api/models/${id}`, { isDefault: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-models"] }),
    onError: (err: any) => toast(err.message ?? t("admin.setDefaultFailed", { defaultValue: "Failed to set default model" }), "error"),
  });

  const saveFallbackOrder = useMutation({
    mutationFn: (order: Array<{ id: string; fallbackOrder: number; isFallback: boolean }>) =>
      api.put("/api/models/fallback-order", { order }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-models"] }),
    onError: (err: any) => toast(err.message ?? t("admin.fallbackOrderFailed", { defaultValue: "Failed to update fallback order" }), "error"),
  });

  const allModels: any[] = (modelsData as any)?.data ?? [];
  const providers: any[] = (providersData as any)?.data ?? [];
  const stats: any[] = (statsData as any)?.data ?? [];

  const enabledModels = allModels.filter((m) => m.isEnabled);
  const fallbackModels = allModels
    .filter((m) => m.isFallback)
    .sort((a, b) => (a.fallbackOrder ?? 999) - (b.fallbackOrder ?? 999));

  const getStats = (modelId: string) =>
    stats.find((s: any) => s.modelId === modelId) ?? { requests: 0, avgLatencyMs: null, errorRate: null };

  const getProviderName = (providerId: string) =>
    providers.find((p) => p.id === providerId)?.name ?? "Unknown";

  // Drag-and-drop for fallback reordering
  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!draggedId || draggedId === targetId) return;

      const currentOrder = [...fallbackModels];
      const dragIdx = currentOrder.findIndex((m) => m.id === draggedId);
      const dropIdx = currentOrder.findIndex((m) => m.id === targetId);
      if (dragIdx === -1 || dropIdx === -1) return;

      const [moved] = currentOrder.splice(dragIdx, 1);
      currentOrder.splice(dropIdx, 0, moved);

      const newOrder = currentOrder.map((m, i) => ({
        id: m.id,
        fallbackOrder: i,
        isFallback: true,
      }));

      saveFallbackOrder.mutate(newOrder);
      setDraggedId(null);
    },
    [draggedId, fallbackModels, saveFallbackOrder],
  );

  // Keyboard-based reordering
  const moveFallback = useCallback(
    (modelId: string, direction: "up" | "down") => {
      const currentOrder = [...fallbackModels];
      const idx = currentOrder.findIndex((m) => m.id === modelId);
      if (idx === -1) return;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= currentOrder.length) return;

      [currentOrder[idx], currentOrder[targetIdx]] = [currentOrder[targetIdx], currentOrder[idx]];

      const newOrder = currentOrder.map((m, i) => ({
        id: m.id,
        fallbackOrder: i,
        isFallback: true,
      }));

      saveFallbackOrder.mutate(newOrder);
    },
    [fallbackModels, saveFallbackOrder],
  );

  const addToFallback = useCallback(
    (modelId: string) => {
      const nextOrder = fallbackModels.length;
      const existing = fallbackModels.map((m, i) => ({
        id: m.id,
        fallbackOrder: i,
        isFallback: true,
      }));
      saveFallbackOrder.mutate([...existing, { id: modelId, fallbackOrder: nextOrder, isFallback: true }]);
    },
    [fallbackModels, saveFallbackOrder],
  );

  const removeFromFallback = useCallback(
    (modelId: string) => {
      const remaining = fallbackModels
        .filter((m) => m.id !== modelId)
        .map((m, i) => ({ id: m.id, fallbackOrder: i, isFallback: true }));
      saveFallbackOrder.mutate([...remaining, { id: modelId, fallbackOrder: 0, isFallback: false }]);
    },
    [fallbackModels, saveFallbackOrder],
  );

  return (
    <div className="space-y-8">
      {/* Providers Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text">{t("admin.modelProviders", { defaultValue: "Model Providers" })} ({providers.length})</h2>
            <p className="text-sm text-text-secondary mt-1">{t("admin.modelProvidersDescription", { defaultValue: "Configure LLM providers and API connections." })}</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAddProvider(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("admin.addProvider", { defaultValue: "Add Provider" })}
          </Button>
        </div>

        {providersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((p: any) => (
              <div key={p.id} className="p-4 rounded-xl bg-surface-secondary border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium text-text">{p.name}</span>
                  <Badge variant="default">{p.type}</Badge>
                </div>
                <p className="text-xs text-text-tertiary">{p.apiBaseUrl ?? t("admin.defaultEndpoint", { defaultValue: "Default endpoint" })}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Models Section */}
      <section>
        <h3 className="text-sm font-medium text-text mb-3">
          {t("admin.availableModels", { defaultValue: "Available Models" })} ({allModels.length})
        </h3>
        {modelsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {allModels.map((m: any) => {
              const modelStats = getStats(m.id);
              const capabilities: string[] = Array.isArray(m.capabilities) ? m.capabilities : [];
              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    m.isEnabled
                      ? "bg-surface-secondary border-border"
                      : "bg-surface-secondary/50 border-border/50 opacity-60"
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text truncate">{m.name}</span>
                        {m.isDefault && (
                          <Badge variant="primary">
                            <Star className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
                            {t("admin.default", { defaultValue: "Default" })}
                          </Badge>
                        )}
                        {m.isFallback && (
                          <Badge variant="warning">
                            <Shield className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
                            {t("admin.fallbackN", { defaultValue: "Fallback #{{n}}", n: (m.fallbackOrder ?? 0) + 1 })}
                          </Badge>
                        )}
                        <Badge variant={m.isEnabled ? "success" : "default"}>
                          {m.isEnabled ? t("admin.active", { defaultValue: "Active" }) : t("admin.disabled", { defaultValue: "Disabled" })}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-tertiary mt-1">
                        {getProviderName(m.modelProviderId)} / {m.modelIdExternal}
                      </p>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleModel.mutate({ id: m.id, isEnabled: !m.isEnabled })}
                      className={`ml-2 flex-shrink-0 ${m.isEnabled ? "text-success" : "text-text-tertiary"}`}
                      aria-label={m.isEnabled ? t("admin.disableModel", { defaultValue: "Disable model" }) : t("admin.enableModel", { defaultValue: "Enable model" })}
                    >
                      {m.isEnabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                    </button>
                  </div>

                  {/* Capabilities */}
                  <ModelCapabilityBadges capabilities={capabilities} className="mb-3" />

                  {/* Context window */}
                  {m.contextWindow && (
                    <p className="text-xs text-text-secondary mb-3">
                      {t("admin.context", { defaultValue: "Context: {{tokens}} tokens", tokens: m.contextWindow.toLocaleString() })}
                    </p>
                  )}

                  {/* Usage stats */}
                  <div className="flex items-center gap-4 text-xs text-text-secondary border-t border-border pt-2 mt-2">
                    <span className="flex items-center gap-1" title={t("admin.totalRequests", { defaultValue: "Total requests" })}>
                      <Hash className="h-3 w-3" aria-hidden="true" />
                      {modelStats.requests?.toLocaleString() ?? 0} reqs
                    </span>
                    <span className="flex items-center gap-1" title={t("admin.avgLatency", { defaultValue: "Average latency" })}>
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {modelStats.avgLatencyMs != null
                        ? `${(modelStats.avgLatencyMs / 1000).toFixed(2)}s avg`
                        : "--"}
                    </span>
                    <span
                      className={`flex items-center gap-1 ${
                        modelStats.errorRate > 0.05 ? "text-danger" : ""
                      }`}
                      title={t("admin.errorRate", { defaultValue: "Error rate" })}
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {modelStats.errorRate != null
                        ? `${(modelStats.errorRate * 100).toFixed(1)}%`
                        : "--"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {!m.isDefault && m.isEnabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefault.mutate(m.id)}
                        loading={setDefault.isPending}
                      >
                        <Star className="h-3 w-3" aria-hidden="true" />
                        {t("admin.setAsDefault", { defaultValue: "Set as Default" })}
                      </Button>
                    )}
                    {m.isEnabled && !m.isFallback && (
                      <Button variant="ghost" size="sm" onClick={() => addToFallback(m.id)}>
                        <Shield className="h-3 w-3" aria-hidden="true" />
                        {t("admin.addToFallback", { defaultValue: "Add to Fallback" })}
                      </Button>
                    )}
                    {m.isFallback && (
                      <Button variant="ghost" size="sm" onClick={() => removeFromFallback(m.id)}>
                        {t("admin.removeFallback", { defaultValue: "Remove Fallback" })}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {allModels.length === 0 && (
              <p className="text-sm text-text-tertiary text-center py-8 col-span-2">
                {t("admin.noModels", { defaultValue: "No models configured. Add a provider and configure models." })}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Fallback Chain Configuration */}
      <section>
        <button
          onClick={() => setFallbackExpanded((v) => !v)}
          className="flex items-center gap-2 w-full text-left mb-3"
        >
          <Shield className="h-4 w-4 text-warning" aria-hidden="true" />
          <h3 className="text-sm font-medium text-text">
            {t("admin.fallbackChain", { defaultValue: "Fallback Chain" })} ({fallbackModels.length} {t("admin.models", { defaultValue: "models" })})
          </h3>
          {fallbackExpanded ? (
            <ChevronUp className="h-4 w-4 text-text-tertiary ml-auto" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary ml-auto" aria-hidden="true" />
          )}
        </button>

        {fallbackExpanded && (
          <div className="rounded-xl border border-border bg-surface-secondary p-4">
            {fallbackModels.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-4">
                {t("admin.noFallbackModels", { defaultValue: "No fallback models configured. Add models to the fallback chain from the model cards above." })}
              </p>
            ) : (
              <>
                <p className="text-xs text-text-secondary mb-3">
                  {t("admin.fallbackReorderHelp", { defaultValue: "Drag to reorder, or use the arrow buttons. When the primary model fails, these models are tried in order." })}
                </p>
                <div className="space-y-2">
                  {fallbackModels.map((m: any, idx: number) => (
                    <div
                      key={m.id}
                      draggable
                      onDragStart={() => handleDragStart(m.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(m.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border bg-surface transition-colors cursor-grab active:cursor-grabbing ${
                        draggedId === m.id ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <GripVertical className="h-4 w-4 text-text-tertiary flex-shrink-0" aria-hidden="true" />
                      <span className="w-6 h-6 rounded-full bg-warning/10 text-warning text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{m.name}</p>
                        <p className="text-xs text-text-tertiary">{m.modelIdExternal}</p>
                      </div>
                      {/* Keyboard reorder buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => moveFallback(m.id, "up")}
                          disabled={idx === 0}
                          className="p-1 text-text-tertiary hover:text-text disabled:opacity-30 rounded hover:bg-surface-secondary"
                          aria-label={t("admin.moveUp", { defaultValue: "Move {{name}} up", name: m.name })}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveFallback(m.id, "down")}
                          disabled={idx === fallbackModels.length - 1}
                          className="p-1 text-text-tertiary hover:text-text disabled:opacity-30 rounded hover:bg-surface-secondary"
                          aria-label={t("admin.moveDown", { defaultValue: "Move {{name}} down", name: m.name })}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromFallback(m.id)}
                      >
                        {t("admin.remove", { defaultValue: "Remove" })}
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <Dialog open={showAddProvider} onClose={() => setShowAddProvider(false)} title={t("admin.addModelProvider", { defaultValue: "Add Model Provider" })}>
        <AddProviderForm
          onDone={() => {
            setShowAddProvider(false);
            queryClient.invalidateQueries({ queryKey: ["model-providers"] });
          }}
        />
      </Dialog>
    </div>
  );
}

function AddProviderForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [type, setType] = useState("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const create = useMutation({
    mutationFn: (data: any) => api.post("/api/models/providers", data),
    onSuccess: onDone,
    onError: (err: any) => toast(err.message ?? t("admin.addProviderFailed", { defaultValue: "Failed to add provider" }), "error"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ name, type, apiBaseUrl: baseUrl || undefined, apiKey: apiKey || undefined });
      }}
      className="space-y-4"
    >
      <Input label={t("admin.providerName", { defaultValue: "Provider Name" })} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      <Select
        label={t("admin.type", { defaultValue: "Type" })}
        value={type}
        onChange={(value) => setType(value)}
        options={[
          { value: "openai", label: "OpenAI" },
          { value: "anthropic", label: "Anthropic" },
          { value: "azure", label: "Azure OpenAI" },
          { value: "ollama", label: "Ollama" },
          { value: "custom", label: t("admin.customCompatible", { defaultValue: "Custom (OpenAI-compatible)" }) },
        ]}
      />
      <Input label={t("admin.baseUrl", { defaultValue: "Base URL (optional)" })} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
      <Input label={t("admin.apiKey", { defaultValue: "API Key (optional)" })} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>{t("admin.cancel", { defaultValue: "Cancel" })}</Button>
        <Button type="submit" variant="primary" loading={create.isPending}>{t("admin.addProvider", { defaultValue: "Add Provider" })}</Button>
      </div>
    </form>
  );
}
