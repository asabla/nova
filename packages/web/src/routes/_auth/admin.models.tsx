import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Cpu, Plus, Settings, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";

export const Route = createFileRoute("/_auth/admin/models")({
  component: ModelsPage,
});

function ModelsPage() {
  const queryClient = useQueryClient();
  const [showAddProvider, setShowAddProvider] = useState(false);

  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () => api.get<any>("/api/models"),
  });

  const { data: providersData } = useQuery({
    queryKey: ["model-providers"],
    queryFn: () => api.get<any>("/api/models/providers"),
  });

  const toggleModel = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/models/${id}`, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["models"] }),
  });

  const models = (modelsData as any)?.data ?? [];
  const providers = (providersData as any)?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
            <p className="text-xs text-text-tertiary">{p.baseUrl ?? "Default endpoint"}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-medium text-text mb-3">Available Models ({models.length})</h3>
        <div className="space-y-2">
          {models.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
              <div>
                <p className="text-sm font-medium text-text">{m.name}</p>
                <p className="text-xs text-text-tertiary">
                  {m.modelId} | Context: {m.contextWindow?.toLocaleString() ?? "?"} tokens
                </p>
              </div>
              <button
                onClick={() => toggleModel.mutate({ id: m.id, isEnabled: !m.isEnabled })}
                className={m.isEnabled ? "text-success" : "text-text-tertiary"}
              >
                {m.isEnabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
              </button>
            </div>
          ))}
          {models.length === 0 && (
            <p className="text-sm text-text-tertiary text-center py-8">
              No models configured. Add a provider and configure models.
            </p>
          )}
        </div>
      </div>

      <Dialog open={showAddProvider} onClose={() => setShowAddProvider(false)} title="Add Model Provider">
        <AddProviderForm onDone={() => { setShowAddProvider(false); queryClient.invalidateQueries({ queryKey: ["model-providers"] }); }} />
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
        create.mutate({ name, type, baseUrl: baseUrl || undefined, apiKey: apiKey || undefined });
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
