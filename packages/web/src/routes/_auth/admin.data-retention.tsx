import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Database, Save, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/data-retention")({
  component: DataRetentionPage,
});

interface RetentionSettings {
  conversationRetentionDays: number;
  messageRetentionDays: number;
  fileRetentionDays: number;
  auditLogRetentionDays: number;
  deletedDataPurgeDays: number;
  autoArchiveDays: number;
  autoDeleteArchivedDays: number;
}

const DEFAULTS: RetentionSettings = {
  conversationRetentionDays: 0,
  messageRetentionDays: 0,
  fileRetentionDays: 0,
  auditLogRetentionDays: 365,
  deletedDataPurgeDays: 30,
  autoArchiveDays: 0,
  autoDeleteArchivedDays: 0,
};

function DataRetentionPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<RetentionSettings>(DEFAULTS);

  const { data: orgSettings, isLoading } = useQuery({
    queryKey: ["org-settings", "retention"],
    queryFn: () => api.get<any>("/api/org/settings"),
  });

  useEffect(() => {
    if (orgSettings) {
      const s = orgSettings as Record<string, string>;
      setSettings({
        conversationRetentionDays: Number(s["retention.conversations"] ?? 0),
        messageRetentionDays: Number(s["retention.messages"] ?? 0),
        fileRetentionDays: Number(s["retention.files"] ?? 0),
        auditLogRetentionDays: Number(s["retention.audit_logs"] ?? 365),
        deletedDataPurgeDays: Number(s["retention.deleted_purge"] ?? 30),
        autoArchiveDays: Number(s["retention.auto_archive"] ?? 0),
        autoDeleteArchivedDays: Number(s["retention.auto_delete_archived"] ?? 0),
      });
    }
  }, [orgSettings]);

  const save = useMutation({
    mutationFn: () => api.put("/api/org/settings/bulk", {
      settings: {
        "retention.conversations": String(settings.conversationRetentionDays),
        "retention.messages": String(settings.messageRetentionDays),
        "retention.files": String(settings.fileRetentionDays),
        "retention.audit_logs": String(settings.auditLogRetentionDays),
        "retention.deleted_purge": String(settings.deletedDataPurgeDays),
        "retention.auto_archive": String(settings.autoArchiveDays),
        "retention.auto_delete_archived": String(settings.autoDeleteArchivedDays),
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-settings"] });
      toast(t("admin.retentionSaved", { defaultValue: "Retention settings saved" }), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.retentionSaveFailed", { defaultValue: "Failed to save retention settings" }), "error"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-text">{t("admin.dataRetentionTitle", { defaultValue: "Data Retention" })}</h2>
            <p className="text-sm text-text-secondary mt-1">{t("admin.dataRetentionDescription", { defaultValue: "Configure how long data is kept before automatic cleanup" })}</p>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => save.mutate()} loading={save.isPending}>
          <Save className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.save", { defaultValue: "Save" })}
        </Button>
      </div>

      <div className="p-4 rounded-xl bg-warning/10 border border-warning/30">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-text">{t("admin.retentionWarningTitle", { defaultValue: "Data retention is permanent" })}</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {t("admin.retentionWarningDescription", { defaultValue: "Once data is purged according to these settings, it cannot be recovered. Set to 0 to disable automatic retention (keep forever)." })}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <RetentionField
            label={t("admin.conversationRetention", { defaultValue: "Conversation Retention" })}
            description={t("admin.conversationRetentionDescription", { defaultValue: "Auto-delete conversations older than this many days" })}
            value={settings.conversationRetentionDays}
            onChange={(v) => setSettings({ ...settings, conversationRetentionDays: v })}
          />
          <RetentionField
            label={t("admin.messageRetention", { defaultValue: "Message Retention" })}
            description={t("admin.messageRetentionDescription", { defaultValue: "Auto-delete messages older than this many days" })}
            value={settings.messageRetentionDays}
            onChange={(v) => setSettings({ ...settings, messageRetentionDays: v })}
          />
          <RetentionField
            label={t("admin.fileRetention", { defaultValue: "File Retention" })}
            description={t("admin.fileRetentionDescription", { defaultValue: "Auto-delete uploaded files older than this many days" })}
            value={settings.fileRetentionDays}
            onChange={(v) => setSettings({ ...settings, fileRetentionDays: v })}
          />
          <RetentionField
            label={t("admin.auditLogRetention", { defaultValue: "Audit Log Retention" })}
            description={t("admin.auditLogRetentionDescription", { defaultValue: "Keep audit logs for this many days (minimum 90 for compliance)" })}
            value={settings.auditLogRetentionDays}
            onChange={(v) => setSettings({ ...settings, auditLogRetentionDays: Math.max(90, v) })}
            min={90}
          />
          <RetentionField
            label={t("admin.softDeletePurge", { defaultValue: "Soft-Delete Purge" })}
            description={t("admin.softDeletePurgeDescription", { defaultValue: "Permanently purge soft-deleted items after this many days" })}
            value={settings.deletedDataPurgeDays}
            onChange={(v) => setSettings({ ...settings, deletedDataPurgeDays: v })}
          />
          <RetentionField
            label={t("admin.autoArchive", { defaultValue: "Auto-Archive Inactive" })}
            description={t("admin.autoArchiveDescription", { defaultValue: "Automatically archive conversations with no activity after this many days" })}
            value={settings.autoArchiveDays}
            onChange={(v) => setSettings({ ...settings, autoArchiveDays: v })}
          />
          <RetentionField
            label={t("admin.autoDeleteArchived", { defaultValue: "Auto-Delete Archived" })}
            description={t("admin.autoDeleteArchivedDescription", { defaultValue: "Delete archived conversations after this many days" })}
            value={settings.autoDeleteArchivedDays}
            onChange={(v) => setSettings({ ...settings, autoDeleteArchivedDays: v })}
          />
        </div>
      )}
    </div>
  );
}

function RetentionField({ label, description, value, onChange, min = 0 }: {
  label: string; description: string; value: number; onChange: (v: number) => void; min?: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
      <div className="flex-1">
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          min={min}
          className="w-20 h-8 px-2 text-sm text-right bg-surface border border-border rounded-lg text-text"
          aria-label={label}
        />
        <span className="text-xs text-text-tertiary w-10">{t("admin.days", { defaultValue: "days" })}</span>
        <Badge variant={value === 0 ? "success" : "warning"}>
          {value === 0 ? t("admin.keepForever", { defaultValue: "Keep forever" }) : `${value}d`}
        </Badge>
      </div>
    </div>
  );
}
