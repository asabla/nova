import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Eye, Ban, FileWarning } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/content-filter")({
  component: ContentFilterPage,
});

function ContentFilterPage() {
  const queryClient = useQueryClient();
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showDlpDialog, setShowDlpDialog] = useState(false);
  const [editingFilter, setEditingFilter] = useState<any>(null);
  const [editingDlp, setEditingDlp] = useState<any>(null);
  const [tab, setTab] = useState<"filters" | "dlp">("filters");

  const { data: filters } = useQuery({
    queryKey: ["content-filters"],
    queryFn: () => api.get<any[]>("/api/content/filters"),
  });

  const { data: dlpRules } = useQuery({
    queryKey: ["dlp-rules"],
    queryFn: () => api.get<any[]>("/api/content/dlp"),
  });

  const createFilter = useMutation({
    mutationFn: (data: any) => editingFilter?.id
      ? api.patch(`/api/content/filters/${editingFilter.id}`, data)
      : api.post("/api/content/filters", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-filters"] });
      setShowFilterDialog(false);
      setEditingFilter(null);
      toast("Filter saved", "success");
    },
  });

  const deleteFilter = useMutation({
    mutationFn: (id: string) => api.delete(`/api/content/filters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-filters"] });
      toast("Filter deleted", "success");
    },
  });

  const createDlp = useMutation({
    mutationFn: (data: any) => editingDlp?.id
      ? api.patch(`/api/content/dlp/${editingDlp.id}`, data)
      : api.post("/api/content/dlp", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlp-rules"] });
      setShowDlpDialog(false);
      setEditingDlp(null);
      toast("DLP rule saved", "success");
    },
  });

  const deleteDlp = useMutation({
    mutationFn: (id: string) => api.delete(`/api/content/dlp/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlp-rules"] });
      toast("DLP rule deleted", "success");
    },
  });

  const actionIcon = (action: string) => {
    switch (action) {
      case "block": return <Ban className="h-3.5 w-3.5 text-danger" />;
      case "warn": return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
      case "flag": return <FileWarning className="h-3.5 w-3.5 text-orange-400" />;
      case "redact": return <Eye className="h-3.5 w-3.5 text-blue-400" />;
      case "log": return <Eye className="h-3.5 w-3.5 text-text-tertiary" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-text">Content Safety</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-secondary rounded-lg w-fit">
        <button
          onClick={() => setTab("filters")}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === "filters" ? "bg-surface text-text shadow-sm" : "text-text-tertiary hover:text-text"
          }`}
        >
          Content Filters ({(filters as any[])?.length ?? 0})
        </button>
        <button
          onClick={() => setTab("dlp")}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === "dlp" ? "bg-surface text-text shadow-sm" : "text-text-tertiary hover:text-text"
          }`}
        >
          DLP Rules ({(dlpRules as any[])?.length ?? 0})
        </button>
      </div>

      {/* Content Filters Tab */}
      {tab === "filters" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => { setEditingFilter(null); setShowFilterDialog(true); }}>
              <Plus className="h-3.5 w-3.5" /> Add Filter
            </Button>
          </div>

          {(filters as any[])?.length === 0 && (
            <div className="text-center py-12">
              <Shield className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-secondary">No content filters configured</p>
              <p className="text-xs text-text-tertiary mt-1">Add filters to block or flag inappropriate content</p>
            </div>
          )}

          {(filters as any[])?.map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
              <div className="flex items-center gap-3">
                {actionIcon(f.action)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{f.name}</span>
                    <Badge variant={f.isEnabled ? "success" : "default"}>{f.isEnabled ? "Active" : "Disabled"}</Badge>
                    <Badge variant="default">{f.type}</Badge>
                    <Badge variant={f.severity === "critical" ? "danger" : f.severity === "high" ? "warning" : "default"}>
                      {f.severity}
                    </Badge>
                  </div>
                  {f.pattern && <p className="text-xs text-text-tertiary mt-0.5 font-mono">{f.pattern.slice(0, 60)}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditingFilter(f); setShowFilterDialog(true); }}
                  className="p-1.5 text-text-tertiary hover:text-text rounded-lg hover:bg-surface"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteFilter.mutate(f.id)}
                  className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DLP Rules Tab */}
      {tab === "dlp" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => { setEditingDlp(null); setShowDlpDialog(true); }}>
              <Plus className="h-3.5 w-3.5" /> Add DLP Rule
            </Button>
          </div>

          {(dlpRules as any[])?.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-secondary">No DLP rules configured</p>
              <p className="text-xs text-text-tertiary mt-1">Add rules to detect and protect sensitive data</p>
            </div>
          )}

          {(dlpRules as any[])?.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
              <div className="flex items-center gap-3">
                {actionIcon(r.action)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{r.name}</span>
                    <Badge variant={r.isEnabled ? "success" : "default"}>{r.isEnabled ? "Active" : "Disabled"}</Badge>
                    <Badge variant="default">{r.detectorType}</Badge>
                    <Badge variant="default">{r.appliesTo}</Badge>
                  </div>
                  {r.description && <p className="text-xs text-text-tertiary mt-0.5">{r.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditingDlp(r); setShowDlpDialog(true); }}
                  className="p-1.5 text-text-tertiary hover:text-text rounded-lg hover:bg-surface"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteDlp.mutate(r.id)}
                  className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content Filter Dialog */}
      <FilterFormDialog
        open={showFilterDialog}
        onClose={() => { setShowFilterDialog(false); setEditingFilter(null); }}
        initial={editingFilter}
        onSubmit={(data) => createFilter.mutate(data)}
        isPending={createFilter.isPending}
      />

      {/* DLP Rule Dialog */}
      <DlpFormDialog
        open={showDlpDialog}
        onClose={() => { setShowDlpDialog(false); setEditingDlp(null); }}
        initial={editingDlp}
        onSubmit={(data) => createDlp.mutate(data)}
        isPending={createDlp.isPending}
      />
    </div>
  );
}

function FilterFormDialog({ open, onClose, initial, onSubmit, isPending }: {
  open: boolean; onClose: () => void; initial: any; onSubmit: (data: any) => void; isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "keyword");
  const [pattern, setPattern] = useState(initial?.pattern ?? "");
  const [action, setAction] = useState(initial?.action ?? "warn");
  const [severity, setSeverity] = useState(initial?.severity ?? "medium");

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Edit Filter" : "New Content Filter"}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, type, pattern, action, severity }); }} className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <div>
          <label className="block text-sm font-medium text-text mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
            <option value="keyword">Keyword</option>
            <option value="regex">Regex</option>
            <option value="category">Category</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Pattern</label>
          <textarea value={pattern} onChange={(e) => setPattern(e.target.value)} rows={3}
            className="w-full p-2 text-sm bg-surface border border-border rounded-lg text-text font-mono resize-y"
            placeholder={type === "regex" ? "\\b(badword|offensive)\\b" : "comma,separated,keywords"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
              <option value="block">Block</option>
              <option value="warn">Warn</option>
              <option value="flag">Flag</option>
              <option value="redact">Redact</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={isPending}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}

function DlpFormDialog({ open, onClose, initial, onSubmit, isPending }: {
  open: boolean; onClose: () => void; initial: any; onSubmit: (data: any) => void; isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [detectorType, setDetectorType] = useState(initial?.detectorType ?? "regex");
  const [pattern, setPattern] = useState(initial?.pattern ?? "");
  const [action, setAction] = useState(initial?.action ?? "redact");
  const [appliesTo, setAppliesTo] = useState(initial?.appliesTo ?? "both");

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Edit DLP Rule" : "New DLP Rule"}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, description, detectorType, pattern, action, appliesTo }); }} className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Detector Type</label>
            <select value={detectorType} onChange={(e) => setDetectorType(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
              <option value="regex">Regex</option>
              <option value="keyword">Keyword</option>
              <option value="ner">Named Entity</option>
              <option value="pii">PII Detection</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Applies To</label>
            <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
              <option value="input">Input Only</option>
              <option value="output">Output Only</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Pattern</label>
          <textarea value={pattern} onChange={(e) => setPattern(e.target.value)} rows={3}
            className="w-full p-2 text-sm bg-surface border border-border rounded-lg text-text font-mono resize-y"
            placeholder="\\b\\d{3}-\\d{2}-\\d{4}\\b" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
            <option value="block">Block</option>
            <option value="redact">Redact</option>
            <option value="warn">Warn</option>
            <option value="log">Log Only</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={isPending}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
