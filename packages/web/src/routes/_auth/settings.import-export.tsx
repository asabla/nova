import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Upload, Download, FileJson, MessageSquare, Bot, Trash2, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/settings/import-export")({
  component: ImportExportPage,
});

function ImportExportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<"chatgpt" | "claude" | null>(null);

  const importData = useMutation({
    mutationFn: async ({ type, file }: { type: string; file: File }) => {
      const text = await file.text();
      const data = JSON.parse(text);
      return api.post(`/api/import/${type}`, { data });
    },
    onSuccess: (result: any) => {
      toast(`Imported ${result?.imported ?? 0} conversations`, "success");
      setImportType(null);
    },
    onError: () => {
      toast("Import failed. Please check the file format.", "error");
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
    onSuccess: () => toast("Deletion request submitted. Your data will be removed.", "success"),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && importType) {
      importData.mutate({ type: importType, file });
    }
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
        <h2 className="text-sm font-medium text-text mb-4">Import Data</h2>
        <div className="grid grid-cols-2 gap-4">
          <ImportCard
            icon={MessageSquare}
            title="Import from ChatGPT"
            description="Import your conversations from OpenAI ChatGPT export (JSON format)"
            onImport={() => startImport("chatgpt")}
            loading={importData.isPending && importType === "chatgpt"}
          />
          <ImportCard
            icon={Bot}
            title="Import from Claude"
            description="Import your conversations from Anthropic Claude export (JSON format)"
            onImport={() => startImport("claude")}
            loading={importData.isPending && importType === "claude"}
          />
        </div>
      </section>

      {/* Export */}
      <section>
        <h2 className="text-sm font-medium text-text mb-4">Export Data</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
            <div className="flex items-center gap-3">
              <FileJson className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-text">Export All Data</p>
                <p className="text-xs text-text-tertiary">Download all your conversations, messages, agents, and files as JSON</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportAll.mutate()}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>
      </section>

      {/* GDPR */}
      <section>
        <h2 className="text-sm font-medium text-text mb-4">GDPR Data Rights</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-text">GDPR Data Export</p>
                <p className="text-xs text-text-tertiary">Download a complete copy of all your personal data (Article 20)</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => gdprExport.mutate()}>
              Request Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-danger/5 border border-danger/20">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-danger" />
              <div>
                <p className="text-sm font-medium text-text">Delete All Data</p>
                <p className="text-xs text-text-tertiary">Permanently delete all your personal data (Article 17 - Right to Erasure)</p>
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
  return (
    <div className="p-4 rounded-xl bg-surface-secondary border border-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-medium text-text">{title}</h3>
      </div>
      <p className="text-xs text-text-tertiary mb-4">{description}</p>
      <Button variant="outline" size="sm" onClick={onImport} loading={loading}>
        <Upload className="h-3.5 w-3.5" /> Choose File
      </Button>
    </div>
  );
}

function DeleteConfirmButton({ onConfirm, loading }: { onConfirm: () => void; loading: boolean }) {
  const [step, setStep] = useState(0);

  if (step === 0) {
    return (
      <Button variant="danger" size="sm" onClick={() => setStep(1)}>
        Request Deletion
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-danger">Are you sure?</span>
      <Button variant="ghost" size="sm" onClick={() => setStep(0)}>Cancel</Button>
      <Button variant="danger" size="sm" onClick={() => { onConfirm(); setStep(0); }} loading={loading}>
        Confirm Delete
      </Button>
    </div>
  );
}
