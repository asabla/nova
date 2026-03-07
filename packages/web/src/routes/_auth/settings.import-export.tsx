import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Upload, Download, FileJson, MessageSquare, Bot, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/settings/import-export")({
  component: ImportExportPage,
});

const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50MB

function ImportExportPage() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<"chatgpt" | "claude" | null>(null);

  const importData = useMutation({
    mutationFn: async ({ type, file }: { type: string; file: File }) => {
      const text = await file.text();
      const data = JSON.parse(text);
      return api.post(`/api/import/${type}`, { data });
    },
    onSuccess: (result: any) => {
      toast(
        t("settings.importSuccess", {
          count: result?.imported ?? 0,
          defaultValue: `Imported ${result?.imported ?? 0} conversations`,
        }),
        "success",
      );
      setImportType(null);
    },
    onError: () => {
      toast(t("settings.importFailed", "Import failed. Please check the file format."), "error");
    },
  });

  const exportAll = useMutation({
    mutationFn: () => {
      const apiBase = import.meta.env.VITE_API_URL ?? "";
      window.open(`${apiBase}/api/export/user-data`, "_blank");
      return Promise.resolve();
    },
  });

  const gdprExport = useMutation({
    mutationFn: () => {
      const apiBase = import.meta.env.VITE_API_URL ?? "";
      window.open(`${apiBase}/api/gdpr/export`, "_blank");
      return Promise.resolve();
    },
  });

  const gdprDelete = useMutation({
    mutationFn: () => api.post("/api/gdpr/delete"),
    onSuccess: () =>
      toast(t("settings.gdprDeleteSuccess", "Deletion request submitted. Your data will be removed."), "success"),
    onError: () =>
      toast(t("settings.gdprDeleteFailed", "Failed to submit deletion request. Please try again."), "error"),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importType) return;

    // File size validation
    if (file.size > MAX_IMPORT_SIZE) {
      toast(
        t("settings.importFileTooLarge", "File is too large. Maximum size is 50MB."),
        "error",
      );
      // Reset input so user can select again
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    importData.mutate({ type: importType, file });
  };

  const startImport = (type: "chatgpt" | "claude") => {
    setImportType(type);
    fileRef.current?.click();
  };

  return (
    <div className="space-y-8">
      <input ref={fileRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />

      {/* Import */}
      <section>
        <h2 className="text-sm font-medium text-text mb-4">
          {t("settings.importData", "Import Data")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ImportCard
            icon={MessageSquare}
            title={t("settings.importFromChatGPT", "Import from ChatGPT")}
            description={t("settings.importFromChatGPTDescription", "Import your conversations from OpenAI ChatGPT export (JSON format)")}
            onImport={() => startImport("chatgpt")}
            loading={importData.isPending && importType === "chatgpt"}
          />
          <ImportCard
            icon={Bot}
            title={t("settings.importFromClaude", "Import from Claude")}
            description={t("settings.importFromClaudeDescription", "Import your conversations from Anthropic Claude export (JSON format)")}
            onImport={() => startImport("claude")}
            loading={importData.isPending && importType === "claude"}
          />
        </div>
      </section>

      {/* Export */}
      <section>
        <h2 className="text-sm font-medium text-text mb-4">
          {t("settings.exportData", "Export Data")}
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
            <div className="flex items-center gap-3">
              <FileJson className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-text">
                  {t("settings.exportAllData", "Export All Data")}
                </p>
                <p className="text-xs text-text-tertiary">
                  {t("settings.exportAllDataDescription", "Download all your conversations, messages, agents, and files as JSON")}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportAll.mutate()}
              loading={exportAll.isPending}
            >
              <Download className="h-3.5 w-3.5" /> {t("settings.export", "Export")}
            </Button>
          </div>
        </div>
      </section>

      {/* GDPR */}
      <section>
        <h2 className="text-sm font-medium text-text mb-4">
          {t("settings.gdprDataRights", "GDPR Data Rights")}
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-text">
                  {t("settings.gdprDataExport", "GDPR Data Export")}
                </p>
                <p className="text-xs text-text-tertiary">
                  {t("settings.gdprDataExportDescription", "Download a complete copy of all your personal data (Article 20)")}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => gdprExport.mutate()}
              loading={gdprExport.isPending}
            >
              {t("settings.requestExport", "Request Export")}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-danger/5 border border-danger/20">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-danger" />
              <div>
                <p className="text-sm font-medium text-text">
                  {t("settings.deleteAllData", "Delete All Data")}
                </p>
                <p className="text-xs text-text-tertiary">
                  {t("settings.deleteAllDataDescription", "Permanently delete all your personal data (Article 17 - Right to Erasure)")}
                </p>
              </div>
            </div>
            <DeleteConfirmButton onConfirm={() => gdprDelete.mutate()} loading={gdprDelete.isPending} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ImportCard({ icon: Icon, title, description, onImport, loading }: {
  icon: any; title: string; description: string; onImport: () => void; loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="p-4 rounded-xl bg-surface-secondary border border-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-medium text-text">{title}</h3>
      </div>
      <p className="text-xs text-text-tertiary mb-4">{description}</p>
      <Button variant="secondary" size="sm" onClick={onImport} loading={loading}>
        <Upload className="h-3.5 w-3.5" /> {t("settings.chooseFile", "Choose File")}
      </Button>
    </div>
  );
}

function DeleteConfirmButton({ onConfirm, loading }: { onConfirm: () => void; loading: boolean }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [confirmText, setConfirmText] = useState("");

  if (step === 0) {
    return (
      <Button variant="danger" size="sm" onClick={() => setStep(1)}>
        {t("settings.requestDeletion", "Request Deletion")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <p className="text-xs text-danger">
        {t("settings.typeDeleteToConfirm", 'Type "DELETE" to confirm')}
      </p>
      <Input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="DELETE"
        className="w-40 text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStep(0);
            setConfirmText("");
          }}
        >
          {t("common.cancel", "Cancel")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            onConfirm();
            setStep(0);
            setConfirmText("");
          }}
          loading={loading}
          disabled={confirmText !== "DELETE"}
        >
          {t("settings.confirmDelete", "Confirm Delete")}
        </Button>
      </div>
    </div>
  );
}
