import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/settings")({
  component: SettingsPage,
});

const DEFAULT_SETTINGS = [
  { key: "default_billing_plan", label: "Default billing plan for new orgs", type: "select", options: ["free", "team", "enterprise"] },
  { key: "max_orgs", label: "Maximum organisations", type: "number" },
  { key: "maintenance_mode", label: "Maintenance mode", type: "boolean" },
  { key: "signup_enabled", label: "Allow new signups", type: "boolean" },
  { key: "default_model", label: "Default model ID", type: "text" },
  { key: "max_file_size_mb", label: "Max file upload size (MB)", type: "number" },
  { key: "rate_limit_rpm", label: "Default rate limit (requests/min)", type: "number" },
];

function SettingsPage() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showAddCustom, setShowAddCustom] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/settings"),
  });

  const settings = data?.data ?? [];
  const settingsMap = new Map(settings.map((s: any) => [s.key, s.value]));

  const saveSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      adminApi.put(`/admin-api/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      setEditingKey(null);
    },
  });

  const handleSave = (key: string, value: string) => {
    saveSetting.mutate({ key, value });
  };

  const handleToggle = (key: string, currentValue: string | undefined) => {
    const newValue = currentValue === "true" ? "false" : "true";
    saveSetting.mutate({ key, value: newValue });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Platform Settings</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Configure platform-wide defaults, limits, and feature flags
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          {DEFAULT_SETTINGS.map((setting) => {
            const currentValue = settingsMap.get(setting.key);
            const isEditing = editingKey === setting.key;

            return (
              <div
                key={setting.key}
                className="flex items-center justify-between px-5 py-4 transition-colors"
                style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{setting.label}</p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>{setting.key}</p>
                </div>

                {setting.type === "boolean" ? (
                  <button
                    onClick={() => handleToggle(setting.key, currentValue)}
                    className="transition-colors"
                    style={{ color: currentValue === "true" ? "var(--color-accent-green)" : "var(--color-text-muted)" }}
                  >
                    {currentValue === "true" ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                ) : isEditing ? (
                  <div className="flex items-center gap-2">
                    {setting.type === "select" ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 rounded-lg border px-2 text-sm"
                        style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
                      >
                        {setting.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        type={setting.type === "number" ? "number" : "text"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 w-48 rounded-lg border px-2 text-sm font-mono"
                        style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
                        autoFocus
                      />
                    )}
                    <button
                      onClick={() => handleSave(setting.key, editValue)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--color-accent-green)" }}
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingKey(null)}
                      className="p-1.5 rounded-lg transition-colors text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingKey(setting.key); setEditValue(currentValue ?? ""); }}
                    className="text-sm font-mono px-3 py-1 rounded-lg border transition-colors hover:border-opacity-80"
                    style={{
                      color: currentValue ? "var(--color-text-primary)" : "var(--color-text-muted)",
                      borderColor: "var(--color-border-default)",
                      background: "var(--color-surface-overlay)",
                    }}
                  >
                    {currentValue ?? "Not set"}
                  </button>
                )}
              </div>
            );
          })}

          {/* Custom settings from the database that aren't in DEFAULT_SETTINGS */}
          {settings
            .filter((s: any) => !DEFAULT_SETTINGS.some((d) => d.key === s.key))
            .map((s: any) => (
              <div
                key={s.key}
                className="flex items-center justify-between px-5 py-4 transition-colors"
                style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
              >
                <div>
                  <p className="text-sm font-mono" style={{ color: "var(--color-text-primary)" }}>{s.key}</p>
                </div>
                <span className="text-sm font-mono" style={{ color: "var(--color-text-secondary)" }}>{s.value}</span>
              </div>
            ))}
        </div>
      )}

      {/* Add Custom Setting */}
      <div>
        {showAddCustom ? (
          <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Add Custom Setting</h3>
            <div className="flex gap-3">
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="setting_key"
                className="h-9 flex-1 rounded-lg border px-3 text-sm font-mono"
                style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
              />
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                className="h-9 flex-1 rounded-lg border px-3 text-sm"
                style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
              />
              <button
                onClick={() => { handleSave(newKey, newValue); setNewKey(""); setNewValue(""); setShowAddCustom(false); }}
                disabled={!newKey}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-accent-blue)" }}
              >
                Save
              </button>
              <button onClick={() => setShowAddCustom(false)} className="text-sm" style={{ color: "var(--color-text-muted)" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCustom(true)}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <Plus className="h-4 w-4" /> Add custom setting
          </button>
        )}
      </div>
    </div>
  );
}
