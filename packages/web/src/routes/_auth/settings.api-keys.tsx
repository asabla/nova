import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/settings/api-keys")({
  component: ApiKeysSettings,
});

function ApiKeysSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.get<any>("/api/api-keys"),
  });

  const createKey = useMutation({
    mutationFn: (name: string) => api.post<{ key: string }>("/api/api-keys", { name }),
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) => api.delete(`/api/api-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text flex items-center gap-2">
          <Key className="h-4 w-4" />
          {t("settings.apiKeys")}
        </h3>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" />
          {t("settings.createKey")}
        </Button>
      </div>

      {createdKey && (
        <div className="bg-success/10 border border-success/20 rounded-lg p-3">
          <p className="text-sm text-success font-medium mb-2">API key created! Copy it now - it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-surface-secondary px-2 py-1 rounded font-mono text-text break-all">
              {createdKey}
            </code>
            <button onClick={() => handleCopy(createdKey)} className="text-success hover:text-success/80 p-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(keys as any)?.data?.map((key: any) => (
          <div key={key.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
            <div>
              <p className="text-sm font-medium text-text">{key.name}</p>
              <p className="text-xs text-text-tertiary">
                {key.prefix}••••••••
                {key.lastUsedAt && ` - Last used ${formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}`}
              </p>
            </div>
            <button
              onClick={() => deleteKey.mutate(key.id)}
              className="text-text-tertiary hover:text-danger p-1 rounded transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {!(keys as any)?.data?.length && (
          <div className="text-center py-8 text-sm text-text-tertiary">
            No API keys yet. Create one to get started.
          </div>
        )}
      </div>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title={t("settings.createKey")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newKeyName.trim()) createKey.mutate(newKeyName.trim());
            setShowCreate(false);
          }}
          className="space-y-4"
        >
          <Input
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. Development"
            autoFocus
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={createKey.isPending}>Create</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
