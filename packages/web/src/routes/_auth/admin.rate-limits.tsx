import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Gauge, Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";

interface RateLimitRule {
  id: string;
  scope: string;
  windowSeconds: number;
  maxRequests: number;
  maxTokens?: number;
  isEnabled: boolean;
}

export const Route = createFileRoute("/_auth/admin/rate-limits")({
  component: RateLimitsPage,
});

function RateLimitsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<RateLimitRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["rate-limit-rules"],
    queryFn: () => api.get<RateLimitRule[]>("/api/org/rate-limits"),
  });

  const save = useMutation({
    mutationFn: (data: Omit<RateLimitRule, "id" | "isEnabled">) => editing?.id
      ? api.patch(`/api/org/rate-limits/${editing.id}`, data)
      : api.post("/api/org/rate-limits", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-limit-rules"] });
      setShowDialog(false);
      setEditing(null);
      toast(t("admin.rateLimitSaved", { defaultValue: "Rate limit saved" }), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.rateLimitSaveFailed", { defaultValue: "Failed to save rate limit" }), "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/org/rate-limits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-limit-rules"] });
      toast(t("admin.rateLimitDeleted", { defaultValue: "Rate limit deleted" }), "success");
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toast(err.message ?? t("admin.rateLimitDeleteFailed", { defaultValue: "Failed to delete rate limit" }), "error"),
  });

  const formatWindow = (seconds: number) => {
    if (seconds >= 86400) return `${seconds / 86400}d`;
    if (seconds >= 3600) return `${seconds / 3600}h`;
    if (seconds >= 60) return `${seconds / 60}m`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">{t("admin.rateLimitsTitle", { defaultValue: "Rate Limits" })}</h2>
          <p className="text-sm text-text-secondary mt-1">{t("admin.rateLimitsDescription", { defaultValue: "Configure request and token limits per scope." })}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditing(null); setShowDialog(true); }}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.addRule", { defaultValue: "Add Rule" })}
        </Button>
      </div>

      {/* Default limits info */}
      <div className="p-4 rounded-xl bg-surface-secondary border border-border">
        <h3 className="text-xs font-medium text-text mb-2">{t("admin.defaultLimits", { defaultValue: "Default Limits" })}</h3>
        <div className="grid grid-cols-3 gap-4 text-xs text-text-secondary">
          <div>
            <span className="text-text-tertiary">{t("admin.perUser", { defaultValue: "Per User" })}</span>
            <p className="font-mono mt-0.5">60 req/min, 100K tokens/hr</p>
          </div>
          <div>
            <span className="text-text-tertiary">{t("admin.perOrganization", { defaultValue: "Per Organization" })}</span>
            <p className="font-mono mt-0.5">500 req/min, 1M tokens/hr</p>
          </div>
          <div>
            <span className="text-text-tertiary">{t("admin.apiKeys", { defaultValue: "API Keys" })}</span>
            <p className="font-mono mt-0.5">30 req/min, 50K tokens/hr</p>
          </div>
        </div>
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(rules ?? []).map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
              <div className="flex items-center gap-3">
                <Gauge className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{rule.scope}</Badge>
                    <Badge variant={rule.isEnabled ? "success" : "default"}>{rule.isEnabled ? t("admin.active", { defaultValue: "Active" }) : t("admin.disabled", { defaultValue: "Disabled" })}</Badge>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {rule.maxRequests} {t("admin.requestsPer", { defaultValue: "requests" })} / {formatWindow(rule.windowSeconds)}
                    {rule.maxTokens ? ` | ${(rule.maxTokens / 1000).toFixed(0)}K tokens` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditing(rule); setShowDialog(true); }}
                  className="p-1.5 text-text-tertiary hover:text-text rounded-lg hover:bg-surface"
                  aria-label={t("admin.editRateLimit", { defaultValue: "Edit rate limit" })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(rule.id)}
                  className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
                  aria-label={t("admin.deleteRateLimit", { defaultValue: "Delete rate limit" })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {(rules ?? []).length === 0 && (
            <div className="text-center py-12">
              <Gauge className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-text-secondary">{t("admin.noRateLimits", { defaultValue: "No custom rate limit rules" })}</p>
              <p className="text-xs text-text-tertiary mt-1">{t("admin.defaultLimitsApply", { defaultValue: "Default limits apply to all users" })}</p>
            </div>
          )}
        </div>
      )}

      <RateLimitDialog
        key={editing?.id ?? "new-rate-limit"}
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditing(null); }}
        initial={editing}
        onSubmit={(data) => save.mutate(data)}
        isPending={save.isPending}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && remove.mutate(deleteConfirmId)}
        title={t("admin.confirmDelete", { defaultValue: "Confirm Delete" })}
        description={t("admin.confirmDeleteRateLimit", { defaultValue: "Are you sure you want to delete this rate limit rule? This action cannot be undone." })}
        confirmLabel={t("admin.delete", { defaultValue: "Delete" })}
        isLoading={remove.isPending}
      />
    </div>
  );
}

function RateLimitDialog({ open, onClose, initial, onSubmit, isPending }: {
  open: boolean; onClose: () => void; initial: RateLimitRule | null; onSubmit: (data: Omit<RateLimitRule, "id" | "isEnabled">) => void; isPending: boolean;
}) {
  const { t } = useTranslation();
  const [scope, setScope] = useState(initial?.scope ?? "user");
  const [windowSeconds, setWindowSeconds] = useState(initial?.windowSeconds ?? 60);
  const [maxRequests, setMaxRequests] = useState(initial?.maxRequests ?? 60);
  const [maxTokens, setMaxTokens] = useState(initial?.maxTokens ?? 100000);

  return (
    <Dialog open={open} onClose={onClose} title={initial ? t("admin.editRateLimitTitle", { defaultValue: "Edit Rate Limit" }) : t("admin.newRateLimitTitle", { defaultValue: "New Rate Limit Rule" })}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ scope, windowSeconds, maxRequests, maxTokens }); }} className="space-y-4">
        <Select
          label={t("admin.scope", { defaultValue: "Scope" })}
          value={scope}
          onChange={(value) => setScope(value)}
          options={[
            { value: "user", label: t("admin.perUser", { defaultValue: "Per User" }) },
            { value: "group", label: t("admin.perGroup", { defaultValue: "Per Group" }) },
            { value: "org", label: t("admin.orgWide", { defaultValue: "Organization-wide" }) },
            { value: "api-key", label: t("admin.perApiKey", { defaultValue: "Per API Key" }) },
            { value: "ip", label: t("admin.perIp", { defaultValue: "Per IP Address" }) },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("admin.windowSeconds", { defaultValue: "Window (seconds)" })} type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(Number(e.target.value))} min={1} />
          <Input label={t("admin.maxRequests", { defaultValue: "Max Requests" })} type="number" value={maxRequests} onChange={(e) => setMaxRequests(Number(e.target.value))} min={1} />
        </div>
        <Input label={t("admin.maxTokens", { defaultValue: "Max Tokens" })} type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} min={0} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t("admin.cancel", { defaultValue: "Cancel" })}</Button>
          <Button type="submit" variant="primary" loading={isPending}>{t("admin.save", { defaultValue: "Save" })}</Button>
        </div>
      </form>
    </Dialog>
  );
}
