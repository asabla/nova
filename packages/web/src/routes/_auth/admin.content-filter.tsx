import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Shield, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Eye, Ban, FileWarning } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/content-filter")({
  component: ContentFilterPage,
});

function ContentFilterPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showDlpDialog, setShowDlpDialog] = useState(false);
  const [editingFilter, setEditingFilter] = useState<any>(null);
  const [editingDlp, setEditingDlp] = useState<any>(null);
  const [tab, setTab] = useState<"filters" | "dlp">("filters");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmType, setDeleteConfirmType] = useState<"filter" | "dlp">("filter");

  const { data: filters, isLoading: filtersLoading } = useQuery({
    queryKey: ["content-filters"],
    queryFn: () => api.get<any[]>("/api/content/filters"),
  });

  const { data: dlpRules, isLoading: dlpLoading } = useQuery({
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
      toast(t("admin.filterSaved", { defaultValue: "Filter saved" }), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.filterSaveFailed", { defaultValue: "Failed to save filter" }), "error"),
  });

  const deleteFilter = useMutation({
    mutationFn: (id: string) => api.delete(`/api/content/filters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-filters"] });
      toast(t("admin.filterDeleted", { defaultValue: "Filter deleted" }), "success");
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toast(err.message ?? t("admin.filterDeleteFailed", { defaultValue: "Failed to delete filter" }), "error"),
  });

  const createDlp = useMutation({
    mutationFn: (data: any) => editingDlp?.id
      ? api.patch(`/api/content/dlp/${editingDlp.id}`, data)
      : api.post("/api/content/dlp", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlp-rules"] });
      setShowDlpDialog(false);
      setEditingDlp(null);
      toast(t("admin.dlpRuleSaved", { defaultValue: "DLP rule saved" }), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.dlpRuleSaveFailed", { defaultValue: "Failed to save DLP rule" }), "error"),
  });

  const deleteDlp = useMutation({
    mutationFn: (id: string) => api.delete(`/api/content/dlp/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlp-rules"] });
      toast(t("admin.dlpRuleDeleted", { defaultValue: "DLP rule deleted" }), "success");
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toast(err.message ?? t("admin.dlpRuleDeleteFailed", { defaultValue: "Failed to delete DLP rule" }), "error"),
  });

  const actionIcon = (action: string) => {
    switch (action) {
      case "block": return <Ban className="h-3.5 w-3.5 text-danger" aria-hidden="true" />;
      case "warn": return <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />;
      case "flag": return <FileWarning className="h-3.5 w-3.5 text-orange-400" aria-hidden="true" />;
      case "redact": return <Eye className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />;
      case "log": return <Eye className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />;
      default: return null;
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirmId) return;
    if (deleteConfirmType === "filter") {
      deleteFilter.mutate(deleteConfirmId);
    } else {
      deleteDlp.mutate(deleteConfirmId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">{t("admin.contentSafetyTitle", { defaultValue: "Content Safety" })}</h2>
          <p className="text-sm text-text-secondary mt-1">{t("admin.contentSafetyDescription", { defaultValue: "Configure content filters and data loss prevention rules." })}</p>
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
          {t("admin.contentFilters", { defaultValue: "Content Filters" })} ({(filters as any[])?.length ?? 0})
        </button>
        <button
          onClick={() => setTab("dlp")}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === "dlp" ? "bg-surface text-text shadow-sm" : "text-text-tertiary hover:text-text"
          }`}
        >
          {t("admin.dlpRules", { defaultValue: "DLP Rules" })} ({(dlpRules as any[])?.length ?? 0})
        </button>
      </div>

      {/* Content Filters Tab */}
      {tab === "filters" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => { setEditingFilter(null); setShowFilterDialog(true); }}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.addFilter", { defaultValue: "Add Filter" })}
            </Button>
          </div>

          {filtersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (filters as any[])?.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-text-secondary">{t("admin.noContentFilters", { defaultValue: "No content filters configured" })}</p>
              <p className="text-xs text-text-tertiary mt-1">{t("admin.noContentFiltersHint", { defaultValue: "Add filters to block or flag inappropriate content" })}</p>
            </div>
          ) : (
            (filters as any[])?.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
                <div className="flex items-center gap-3">
                  {actionIcon(f.action)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{f.name}</span>
                      <Badge variant={f.isEnabled ? "success" : "default"}>{f.isEnabled ? t("admin.active", { defaultValue: "Active" }) : t("admin.disabled", { defaultValue: "Disabled" })}</Badge>
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
                    aria-label={t("admin.editFilter", { defaultValue: "Edit filter {{name}}", name: f.name })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setDeleteConfirmId(f.id); setDeleteConfirmType("filter"); }}
                    className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
                    aria-label={t("admin.deleteFilter", { defaultValue: "Delete filter {{name}}", name: f.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* DLP Rules Tab */}
      {tab === "dlp" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => { setEditingDlp(null); setShowDlpDialog(true); }}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.addDlpRule", { defaultValue: "Add DLP Rule" })}
            </Button>
          </div>

          {dlpLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (dlpRules as any[])?.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-text-secondary">{t("admin.noDlpRules", { defaultValue: "No DLP rules configured" })}</p>
              <p className="text-xs text-text-tertiary mt-1">{t("admin.noDlpRulesHint", { defaultValue: "Add rules to detect and protect sensitive data" })}</p>
            </div>
          ) : (
            (dlpRules as any[])?.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
                <div className="flex items-center gap-3">
                  {actionIcon(r.action)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{r.name}</span>
                      <Badge variant={r.isEnabled ? "success" : "default"}>{r.isEnabled ? t("admin.active", { defaultValue: "Active" }) : t("admin.disabled", { defaultValue: "Disabled" })}</Badge>
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
                    aria-label={t("admin.editDlpRule", { defaultValue: "Edit DLP rule {{name}}", name: r.name })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setDeleteConfirmId(r.id); setDeleteConfirmType("dlp"); }}
                    className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
                    aria-label={t("admin.deleteDlpRule", { defaultValue: "Delete DLP rule {{name}}", name: r.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Content Filter Dialog */}
      <FilterFormDialog
        key={editingFilter?.id ?? "new-filter"}
        open={showFilterDialog}
        onClose={() => { setShowFilterDialog(false); setEditingFilter(null); }}
        initial={editingFilter}
        onSubmit={(data) => createFilter.mutate(data)}
        isPending={createFilter.isPending}
      />

      {/* DLP Rule Dialog */}
      <DlpFormDialog
        key={editingDlp?.id ?? "new-dlp"}
        open={showDlpDialog}
        onClose={() => { setShowDlpDialog(false); setEditingDlp(null); }}
        initial={editingDlp}
        onSubmit={(data) => createDlp.mutate(data)}
        isPending={createDlp.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title={t("admin.confirmDelete", { defaultValue: "Confirm Delete" })}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t("admin.confirmDeleteMessage", { defaultValue: "Are you sure you want to delete this item? This action cannot be undone." })}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              {t("admin.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="button"
              variant="primary"
              className="bg-danger hover:bg-danger/90"
              onClick={handleDeleteConfirm}
              loading={deleteFilter.isPending || deleteDlp.isPending}
            >
              {t("admin.delete", { defaultValue: "Delete" })}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function FilterFormDialog({ open, onClose, initial, onSubmit, isPending }: {
  open: boolean; onClose: () => void; initial: any; onSubmit: (data: any) => void; isPending: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "keyword");
  const [pattern, setPattern] = useState(initial?.pattern ?? "");
  const [action, setAction] = useState(initial?.action ?? "warn");
  const [severity, setSeverity] = useState(initial?.severity ?? "medium");

  return (
    <Dialog open={open} onClose={onClose} title={initial ? t("admin.editFilterTitle", { defaultValue: "Edit Filter" }) : t("admin.newFilterTitle", { defaultValue: "New Content Filter" })}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, type, pattern, action, severity }); }} className="space-y-4">
        <Input label={t("admin.name", { defaultValue: "Name" })} value={name} onChange={(e) => setName(e.target.value)} required />
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t("admin.type", { defaultValue: "Type" })}</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
            <option value="keyword">{t("admin.keyword", { defaultValue: "Keyword" })}</option>
            <option value="regex">{t("admin.regex", { defaultValue: "Regex" })}</option>
            <option value="category">{t("admin.category", { defaultValue: "Category" })}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t("admin.pattern", { defaultValue: "Pattern" })}</label>
          <textarea value={pattern} onChange={(e) => setPattern(e.target.value)} rows={3}
            className="w-full p-2 text-sm bg-surface border border-border rounded-lg text-text font-mono resize-y"
            placeholder={type === "regex" ? "\\b(badword|offensive)\\b" : "comma,separated,keywords"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("admin.action", { defaultValue: "Action" })}</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
              <option value="block">{t("admin.block", { defaultValue: "Block" })}</option>
              <option value="warn">{t("admin.warn", { defaultValue: "Warn" })}</option>
              <option value="flag">{t("admin.flag", { defaultValue: "Flag" })}</option>
              <option value="redact">{t("admin.redact", { defaultValue: "Redact" })}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("admin.severity", { defaultValue: "Severity" })}</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
              <option value="low">{t("admin.low", { defaultValue: "Low" })}</option>
              <option value="medium">{t("admin.medium", { defaultValue: "Medium" })}</option>
              <option value="high">{t("admin.high", { defaultValue: "High" })}</option>
              <option value="critical">{t("admin.critical", { defaultValue: "Critical" })}</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t("admin.cancel", { defaultValue: "Cancel" })}</Button>
          <Button type="submit" variant="primary" loading={isPending}>{t("admin.save", { defaultValue: "Save" })}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function DlpFormDialog({ open, onClose, initial, onSubmit, isPending }: {
  open: boolean; onClose: () => void; initial: any; onSubmit: (data: any) => void; isPending: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [detectorType, setDetectorType] = useState(initial?.detectorType ?? "regex");
  const [pattern, setPattern] = useState(initial?.pattern ?? "");
  const [action, setAction] = useState(initial?.action ?? "redact");
  const [appliesTo, setAppliesTo] = useState(initial?.appliesTo ?? "both");

  return (
    <Dialog open={open} onClose={onClose} title={initial ? t("admin.editDlpRuleTitle", { defaultValue: "Edit DLP Rule" }) : t("admin.newDlpRuleTitle", { defaultValue: "New DLP Rule" })}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, description, detectorType, pattern, action, appliesTo }); }} className="space-y-4">
        <Input label={t("admin.name", { defaultValue: "Name" })} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label={t("admin.description", { defaultValue: "Description" })} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("admin.detectorType", { defaultValue: "Detector Type" })}</label>
            <select value={detectorType} onChange={(e) => setDetectorType(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
              <option value="regex">{t("admin.regex", { defaultValue: "Regex" })}</option>
              <option value="keyword">{t("admin.keyword", { defaultValue: "Keyword" })}</option>
              <option value="ner">{t("admin.namedEntity", { defaultValue: "Named Entity" })}</option>
              <option value="pii">{t("admin.piiDetection", { defaultValue: "PII Detection" })}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("admin.appliesTo", { defaultValue: "Applies To" })}</label>
            <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
              <option value="input">{t("admin.inputOnly", { defaultValue: "Input Only" })}</option>
              <option value="output">{t("admin.outputOnly", { defaultValue: "Output Only" })}</option>
              <option value="both">{t("admin.both", { defaultValue: "Both" })}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t("admin.pattern", { defaultValue: "Pattern" })}</label>
          <textarea value={pattern} onChange={(e) => setPattern(e.target.value)} rows={3}
            className="w-full p-2 text-sm bg-surface border border-border rounded-lg text-text font-mono resize-y"
            placeholder="\\b\\d{3}-\\d{2}-\\d{4}\\b" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t("admin.action", { defaultValue: "Action" })}</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
            <option value="block">{t("admin.block", { defaultValue: "Block" })}</option>
            <option value="redact">{t("admin.redact", { defaultValue: "Redact" })}</option>
            <option value="warn">{t("admin.warn", { defaultValue: "Warn" })}</option>
            <option value="log">{t("admin.logOnly", { defaultValue: "Log Only" })}</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t("admin.cancel", { defaultValue: "Cancel" })}</Button>
          <Button type="submit" variant="primary" loading={isPending}>{t("admin.save", { defaultValue: "Save" })}</Button>
        </div>
      </form>
    </Dialog>
  );
}
