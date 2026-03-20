import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import { formatRelativeTime } from "../../lib/format";

export const Route = createFileRoute("/_auth/settings/api-keys")({
  component: ApiKeysSettings,
});

function ApiKeysSkeleton() {
  return (
    <div className="space-y-6 max-w-lg animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-surface-secondary rounded" />
        <div className="h-8 w-28 bg-surface-secondary rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="h-16 w-full bg-surface-secondary rounded-xl" />
        <div className="h-16 w-full bg-surface-secondary rounded-xl" />
        <div className="h-16 w-full bg-surface-secondary rounded-xl" />
      </div>
    </div>
  );
}

function ApiKeysSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.get<any>("/api/api-keys"),
  });

  const createKey = useMutation({
    mutationFn: (name: string) => api.post<{ key: string }>("/api/api-keys", { name }),
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setNewKeyName("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => {
      toast(t("settings.apiKeyCreateFailed", "Failed to create API key. Please try again."), "error");
    },
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) => api.delete(`/api/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setDeleteTarget(null);
      toast(t("settings.apiKeyDeleted", "API key deleted"), "success");
    },
    onError: () => {
      toast(t("settings.apiKeyDeleteFailed", "Failed to delete API key. Please try again."), "error");
    },
  });

  const handleCopy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t("settings.clipboardFailed", "Failed to copy to clipboard"), "error");
    }
  };

  if (isLoading) {
    return <ApiKeysSkeleton />;
  }

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
          <p className="text-sm text-success font-medium mb-2">
            {t("settings.apiKeyCreatedNotice", "API key created! Copy it now - it won't be shown again.")}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-surface-secondary px-2 py-1 rounded font-mono text-text break-all">
              {createdKey}
            </code>
            <button
              onClick={() => handleCopy(createdKey)}
              aria-label={t("settings.copyApiKey", "Copy API key")}
              className="text-success hover:text-success/80 p-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
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
                {key.prefix}{"••••••••"}
                {key.lastUsedAt && ` - ${t("settings.lastUsed", "Last used")} ${formatRelativeTime(key.lastUsedAt)}`}
              </p>
            </div>
            <button
              onClick={() => setDeleteTarget({ id: key.id, name: key.name })}
              aria-label={t("settings.deleteApiKey", { name: key.name, defaultValue: `Delete API key ${key.name}` })}
              className="text-text-tertiary hover:text-danger p-1 rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {!(keys as any)?.data?.length && (
          <div className="text-center py-8 text-sm text-text-tertiary">
            {t("settings.noApiKeys", "No API keys yet. Create one to get started.")}
          </div>
        )}
      </div>

      {/* Create Key Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title={t("settings.createKey")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newKeyName.trim()) createKey.mutate(newKeyName.trim());
          }}
          className="space-y-4"
        >
          <Input
            label={t("settings.keyName", "Key Name")}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t("settings.keyNamePlaceholder", "e.g. Development")}
            autoFocus
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="submit" variant="primary" loading={createKey.isPending}>
              {t("settings.create", "Create")}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("settings.deleteApiKeyTitle", "Delete API Key")}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t("settings.deleteApiKeyConfirmation", {
              name: deleteTarget?.name,
              defaultValue: `Are you sure you want to delete the API key "${deleteTarget?.name}"? This action cannot be undone.`,
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteTarget && deleteKey.mutate(deleteTarget.id)}
              loading={deleteKey.isPending}
            >
              {t("settings.deleteKey", "Delete Key")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
