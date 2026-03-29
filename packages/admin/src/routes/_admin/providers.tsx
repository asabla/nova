import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Server, Plus, Trash2, Eye, EyeOff, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/providers")({
  component: ProvidersPage,
});

const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI", placeholder: "sk-..." },
  { value: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { value: "azure", label: "Azure OpenAI", placeholder: "Azure API key" },
  { value: "ollama", label: "Ollama (Local)", placeholder: "Not required" },
  { value: "custom", label: "Custom / OpenAI-compatible", placeholder: "API key" },
];

function ProvidersPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Platform providers are stored as system org settings
  const { data, isLoading } = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/settings"),
  });

  const providers: any[] = (() => {
    const settings = data?.data ?? [];
    const providerSetting = settings.find((s: any) => s.key === "model_providers");
    if (providerSetting) {
      try { return JSON.parse(providerSetting.value); } catch { return []; }
    }
    return [];
  })();

  const saveProviders = useMutation({
    mutationFn: (newProviders: any[]) =>
      adminApi.put("/admin-api/settings/model_providers", { value: newProviders }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-providers"] }),
  });

  const handleAdd = () => {
    const newProvider = {
      id: crypto.randomUUID(),
      name: name || PROVIDER_TYPES.find((p) => p.value === type)?.label || type,
      type,
      apiKey: apiKey || undefined,
      baseUrl: baseUrl || undefined,
      createdAt: new Date().toISOString(),
    };
    saveProviders.mutate([...providers, newProvider]);
    setShowAdd(false);
    setName("");
    setType("openai");
    setApiKey("");
    setBaseUrl("");
  };

  const handleRemove = (id: string) => {
    saveProviders.mutate(providers.filter((p) => p.id !== id));
  };

  const selectedType = PROVIDER_TYPES.find((p) => p.value === type);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Model Providers</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Configure platform-wide AI model providers. These become defaults for new organisations.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: "var(--color-accent-blue)" }}
        >
          <Plus className="h-4 w-4" /> Add Provider
        </button>
      </div>

      {/* Add Provider Form */}
      {showAdd && (
        <div className="rounded-xl border p-6 space-y-4" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>New Provider</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 font-mono" style={{ color: "var(--color-text-muted)" }}>Provider Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 rounded-lg border px-3 text-sm"
                style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
              >
                {PROVIDER_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 font-mono" style={{ color: "var(--color-text-muted)" }}>Display Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={selectedType?.label}
                className="w-full h-10 rounded-lg border px-3 text-sm"
                style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 font-mono" style={{ color: "var(--color-text-muted)" }}>API Key</label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedType?.placeholder}
                  className="w-full h-10 rounded-lg border px-3 pr-10 text-sm font-mono"
                  style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 font-mono" style={{ color: "var(--color-text-muted)" }}>Base URL (optional)</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full h-10 rounded-lg border px-3 text-sm font-mono"
                style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAdd}
              disabled={type === "custom" && !apiKey}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ background: "var(--color-accent-blue)" }}
            >
              Add Provider
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Provider List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <div className="inline-flex p-4 rounded-xl mb-4" style={{ background: "var(--color-accent-blue-dim)" }}>
            <Server className="h-8 w-8" style={{ color: "var(--color-accent-blue)" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>No providers configured</h3>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--color-text-secondary)" }}>
            Add an AI model provider to enable conversations across the platform. Providers configured here become defaults for new organisations.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: "var(--color-accent-blue)" }}
          >
            <Plus className="h-4 w-4" /> Add First Provider
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider: any) => (
            <div
              key={provider.id}
              className="rounded-xl border p-5 flex items-center justify-between group transition-all duration-150"
              style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg" style={{ background: "var(--color-surface-overlay)" }}>
                  <Server className="h-5 w-5" style={{ color: "var(--color-accent-blue)" }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{provider.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}>
                      {provider.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {provider.apiKey && (
                      <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                        {provider.apiKey.slice(0, 7)}...{provider.apiKey.slice(-4)}
                      </span>
                    )}
                    {provider.baseUrl && (
                      <span className="text-xs font-mono flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                        <ExternalLink className="h-3 w-3" /> {provider.baseUrl}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemove(provider.id)}
                className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-accent-red)" }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
