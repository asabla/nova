import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
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
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { ModelCapabilityBadges } from "../../components/ui/ModelCapabilityBadges";
import { Dialog } from "../../components/ui/Dialog";

export const Route = createFileRoute("/_auth/admin/models")({
  component: ModelsPage,
});

function ModelsPage() {
  const queryClient = useQueryClient();
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [fallbackExpanded, setFallbackExpanded] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const { data: modelsData } = useQuery({
    queryKey: ["admin-models"],
    queryFn: () => api.get<any>("/api/models/all"),
  });

  const { data: providersData } = useQuery({
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
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.patch(`/api/models/${id}`, { isDefault: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-models"] }),
  });

  const saveFallbackOrder = useMutation({
    mutationFn: (order: Array<{ id: string; fallbackOrder: number; isFallback: boolean }>) =>
      api.put("/api/models/fallback-order", { order }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-models"] }),
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
      // Also explicitly mark the removed one
      saveFallbackOrder.mutate([...remaining, { id: modelId, fallbackOrder: 0, isFallback: false }]);
    },
    [fallbackModels, saveFallbackOrder],
  );

  return (
    <div className="space-y-8">
      {/* Providers Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text">Model Providers ({providers.length})</h2>
          <Button variant="primary" size="sm" onClick={() => setShowAddProvider(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Provider
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((p: any) => (
            <div key={p.id} className="p-4 rounded-xl bg-surface-secondary border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-text">{p.name}</span>
                <Badge variant="default">{p.type}</Badge>
              </div>
              <p className="text-xs text-text-tertiary">{p.apiBaseUrl ?? "Default endpoint"}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Models Section */}
      <section>
        <h3 className="text-sm font-medium text-text mb-3">
          Available Models ({allModels.length})
        </h3>
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
                          <Star className="h-2.5 w-2.5 mr-0.5" />
                          Default
                        </Badge>
                      )}
                      {m.isFallback && (
                        <Badge variant="warning">
                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                          Fallback #{(m.fallbackOrder ?? 0) + 1}
                        </Badge>
                      )}
                      <Badge variant={m.isEnabled ? "success" : "default"}>
                        {m.isEnabled ? "Active" : "Disabled"}
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
                    title={m.isEnabled ? "Disable model" : "Enable model"}
                  >
                    {m.isEnabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                </div>

                {/* Capabilities */}
                <ModelCapabilityBadges capabilities={capabilities} className="mb-3" />

                {/* Context window */}
                {m.contextWindow && (
                  <p className="text-xs text-text-secondary mb-3">
                    Context: {m.contextWindow.toLocaleString()} tokens
                  </p>
                )}

                {/* Usage stats */}
                <div className="flex items-center gap-4 text-xs text-text-secondary border-t border-border pt-2 mt-2">
                  <span className="flex items-center gap-1" title="Total requests">
                    <Hash className="h-3 w-3" />
                    {modelStats.requests?.toLocaleString() ?? 0} reqs
                  </span>
                  <span className="flex items-center gap-1" title="Average latency">
                    <Clock className="h-3 w-3" />
                    {modelStats.avgLatencyMs != null
                      ? `${(modelStats.avgLatencyMs / 1000).toFixed(2)}s avg`
                      : "--"}
                  </span>
                  <span
                    className={`flex items-center gap-1 ${
                      modelStats.errorRate > 0.05 ? "text-danger" : ""
                    }`}
                    title="Error rate"
                  >
                    <AlertTriangle className="h-3 w-3" />
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
                      <Star className="h-3 w-3" />
                      Set as Default
                    </Button>
                  )}
                  {m.isEnabled && !m.isFallback && (
                    <Button variant="ghost" size="sm" onClick={() => addToFallback(m.id)}>
                      <Shield className="h-3 w-3" />
                      Add to Fallback
                    </Button>
                  )}
                  {m.isFallback && (
                    <Button variant="ghost" size="sm" onClick={() => removeFromFallback(m.id)}>
                      Remove Fallback
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {allModels.length === 0 && (
            <p className="text-sm text-text-tertiary text-center py-8 col-span-2">
              No models configured. Add a provider and configure models.
            </p>
          )}
        </div>
      </section>

      {/* Fallback Chain Configuration */}
      <section>
        <button
          onClick={() => setFallbackExpanded((v) => !v)}
          className="flex items-center gap-2 w-full text-left mb-3"
        >
          <Shield className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-medium text-text">
            Fallback Chain ({fallbackModels.length} models)
          </h3>
          {fallbackExpanded ? (
            <ChevronUp className="h-4 w-4 text-text-tertiary ml-auto" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary ml-auto" />
          )}
        </button>

        {fallbackExpanded && (
          <div className="rounded-xl border border-border bg-surface-secondary p-4">
            {fallbackModels.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-4">
                No fallback models configured. Add models to the fallback chain from the model cards above.
              </p>
            ) : (
              <>
                <p className="text-xs text-text-secondary mb-3">
                  Drag to reorder. When the primary model fails, these models are tried in order.
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
                      <GripVertical className="h-4 w-4 text-text-tertiary flex-shrink-0" />
                      <span className="w-6 h-6 rounded-full bg-warning/10 text-warning text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{m.name}</p>
                        <p className="text-xs text-text-tertiary">{m.modelIdExternal}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromFallback(m.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <Dialog open={showAddProvider} onClose={() => setShowAddProvider(false)} title="Add Model Provider">
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
  const [name, setName] = useState("");
  const [type, setType] = useState("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const create = useMutation({
    mutationFn: (data: any) => api.post("/api/models/providers", data),
    onSuccess: onDone,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ name, type, apiBaseUrl: baseUrl || undefined, apiKey: apiKey || undefined });
      }}
      className="space-y-4"
    >
      <Input label="Provider Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      <div>
        <label className="block text-sm font-medium text-text mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="azure">Azure OpenAI</option>
          <option value="ollama">Ollama</option>
          <option value="custom">Custom (OpenAI-compatible)</option>
        </select>
      </div>
      <Input label="Base URL (optional)" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
      <Input label="API Key (optional)" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" loading={create.isPending}>Add Provider</Button>
      </div>
    </form>
  );
}
