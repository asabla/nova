import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gauge, Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/rate-limits")({
  component: RateLimitsPage,
});

function RateLimitsPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rules } = useQuery({
    queryKey: ["rate-limit-rules"],
    queryFn: () => api.get<any[]>("/api/org/rate-limits"),
  });

  const save = useMutation({
    mutationFn: (data: any) => editing?.id
      ? api.patch(`/api/org/rate-limits/${editing.id}`, data)
      : api.post("/api/org/rate-limits", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-limit-rules"] });
      setShowDialog(false);
      setEditing(null);
      toast("Rate limit saved", "success");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/org/rate-limits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-limit-rules"] });
      toast("Rate limit deleted", "success");
    },
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
        <div className="flex items-center gap-3">
          <Gauge className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-text">Rate Limits</h2>
            <p className="text-xs text-text-tertiary">Configure request and token limits per scope</p>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditing(null); setShowDialog(true); }}>
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </Button>
      </div>

      {/* Default limits info */}
      <div className="p-4 rounded-xl bg-surface-secondary border border-border">
        <h3 className="text-xs font-medium text-text mb-2">Default Limits</h3>
        <div className="grid grid-cols-3 gap-4 text-xs text-text-secondary">
          <div>
            <span className="text-text-tertiary">Per User</span>
            <p className="font-mono mt-0.5">60 req/min, 100K tokens/hr</p>
          </div>
          <div>
            <span className="text-text-tertiary">Per Organization</span>
            <p className="font-mono mt-0.5">500 req/min, 1M tokens/hr</p>
          </div>
          <div>
            <span className="text-text-tertiary">API Keys</span>
            <p className="font-mono mt-0.5">30 req/min, 50K tokens/hr</p>
          </div>
        </div>
      </div>

      {/* Rules list */}
      <div className="space-y-2">
        {((rules as any[]) ?? []).map((rule: any) => (
          <div key={rule.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
            <div className="flex items-center gap-3">
              <Gauge className="h-4 w-4 text-text-tertiary" />
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">{rule.scope}</Badge>
                  <Badge variant={rule.isEnabled ? "success" : "default"}>{rule.isEnabled ? "Active" : "Disabled"}</Badge>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {rule.maxRequests} requests / {formatWindow(rule.windowSeconds)}
                  {rule.maxTokens ? ` | ${(rule.maxTokens / 1000).toFixed(0)}K tokens` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setEditing(rule); setShowDialog(true); }} className="p-1.5 text-text-tertiary hover:text-text rounded-lg hover:bg-surface">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => remove.mutate(rule.id)} className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {((rules as any[]) ?? []).length === 0 && (
          <div className="text-center py-12">
            <Gauge className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No custom rate limit rules</p>
            <p className="text-xs text-text-tertiary mt-1">Default limits apply to all users</p>
          </div>
        )}
      </div>

      <RateLimitDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditing(null); }}
        initial={editing}
        onSubmit={(data) => save.mutate(data)}
        isPending={save.isPending}
      />
    </div>
  );
}

function RateLimitDialog({ open, onClose, initial, onSubmit, isPending }: {
  open: boolean; onClose: () => void; initial: any; onSubmit: (data: any) => void; isPending: boolean;
}) {
  const [scope, setScope] = useState(initial?.scope ?? "user");
  const [windowSeconds, setWindowSeconds] = useState(initial?.windowSeconds ?? 60);
  const [maxRequests, setMaxRequests] = useState(initial?.maxRequests ?? 60);
  const [maxTokens, setMaxTokens] = useState(initial?.maxTokens ?? 100000);

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Edit Rate Limit" : "New Rate Limit Rule"}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ scope, windowSeconds, maxRequests, maxTokens }); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
            <option value="user">Per User</option>
            <option value="group">Per Group</option>
            <option value="org">Organization-wide</option>
            <option value="api-key">Per API Key</option>
            <option value="ip">Per IP Address</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Window (seconds)" type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(Number(e.target.value))} min={1} />
          <Input label="Max Requests" type="number" value={maxRequests} onChange={(e) => setMaxRequests(Number(e.target.value))} min={1} />
        </div>
        <Input label="Max Tokens" type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} min={0} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={isPending}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
