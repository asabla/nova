import { useState } from "react";
import {
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cloud,
  HardDrive,
  MessageSquare,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Dialog } from "../ui/Dialog";
import { toast } from "../ui/Toast";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { formatDateTime } from "../../lib/format";
import { ConnectorSetupWizard } from "./ConnectorSetupWizard";
import type { KnowledgeConnector } from "./types";

interface SourcesTabProps {
  collectionId: string;
}

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  sharepoint: <Cloud className="h-4 w-4" aria-hidden="true" />,
  onedrive: <HardDrive className="h-4 w-4" aria-hidden="true" />,
  teams: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
};

const PROVIDER_LABELS: Record<string, string> = {
  sharepoint: "SharePoint",
  onedrive: "OneDrive",
  teams: "Teams",
};

function syncStatusBadge(status: string) {
  switch (status) {
    case "success":
      return (
        <Badge variant="success">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Synced
        </Badge>
      );
    case "syncing":
      return (
        <Badge variant="warning">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Syncing
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="danger">
          <AlertCircle className="h-3 w-3" aria-hidden="true" /> Failed
        </Badge>
      );
    default:
      return <Badge variant="default">Pending</Badge>;
  }
}

export function SourcesTab({ collectionId }: SourcesTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: connectorsData, isLoading } = useQuery({
    queryKey: queryKeys.knowledge.connectors(collectionId),
    queryFn: () =>
      api.get<{ data: KnowledgeConnector[] }>(
        `/api/knowledge/${collectionId}/connectors`,
      ),
  });

  const connectors: KnowledgeConnector[] = (connectorsData as any)?.data ?? [];

  const syncMutation = useMutation({
    mutationFn: (connectorId: string) =>
      api.post(`/api/knowledge/${collectionId}/connectors/${connectorId}/sync`),
    onSuccess: () => {
      toast.success("Sync triggered");
      queryClient.invalidateQueries({
        queryKey: queryKeys.knowledge.connectors(collectionId),
      });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to trigger sync"),
  });

  const deleteMutation = useMutation({
    mutationFn: (connectorId: string) =>
      api.delete(`/api/knowledge/${collectionId}/connectors/${connectorId}`),
    onSuccess: () => {
      toast.success("Source removed");
      setDeleteTarget(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.knowledge.connectors(collectionId),
      });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to remove source"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {connectors.length === 0 ? (
        /* ── Empty state — matches Documents tab layout ── */
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Cloud className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-text">
            {t("knowledge.sources.empty", { defaultValue: "No sources connected" })}
          </h3>
          <p className="text-sm text-text-secondary max-w-sm mt-1">
            {t("knowledge.sources.emptyHint", {
              defaultValue: "Sync documents automatically from Microsoft 365.",
            })}
          </p>
          <div className="mt-5">
            <Button variant="primary" size="sm" onClick={() => setShowWizard(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("knowledge.sources.add", { defaultValue: "Add Source" })}
            </Button>
          </div>
        </div>
      ) : (
        /* ── Populated state ── */
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-text">
                {t("knowledge.sources.title", { defaultValue: "Connected Sources" })}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {t("knowledge.sources.description", {
                  defaultValue:
                    "Connect Microsoft 365 sources to automatically sync documents into this collection.",
                })}
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowWizard(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("knowledge.sources.add", { defaultValue: "Add Source" })}
            </Button>
          </div>

          <div className="space-y-3 max-w-3xl">
            {connectors.map((connector) => (
              <div
                key={connector.id}
                className="border border-border rounded-lg p-4 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {PROVIDER_ICONS[connector.provider]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text truncate">
                        {connector.resourceName ?? connector.resourceId}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {PROVIDER_LABELS[connector.provider] ?? connector.provider}
                      </span>
                      {syncStatusBadge(connector.lastSyncStatus)}
                    </div>
                    <div className="text-xs text-text-secondary mt-1 space-x-3">
                      <span>
                        {connector.syncedDocumentCount} doc{connector.syncedDocumentCount !== 1 ? "s" : ""}
                      </span>
                      {connector.lastSyncAt && (
                        <span>Last synced {formatDateTime(connector.lastSyncAt)}</span>
                      )}
                      <span>
                        Every {connector.syncIntervalMinutes < 60
                          ? `${connector.syncIntervalMinutes}m`
                          : `${Math.round(connector.syncIntervalMinutes / 60)}h`}
                      </span>
                    </div>
                    {connector.lastSyncError && (
                      <p className="text-xs text-danger mt-1 truncate">
                        {connector.lastSyncError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => syncMutation.mutate(connector.id)}
                    disabled={syncMutation.isPending || connector.lastSyncStatus === "syncing"}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${connector.lastSyncStatus === "syncing" ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger"
                    onClick={() => setDeleteTarget(connector.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Source Wizard */}
      {showWizard && (
        <ConnectorSetupWizard
          collectionId={collectionId}
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            queryClient.invalidateQueries({
              queryKey: queryKeys.knowledge.connectors(collectionId),
            });
          }}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("knowledge.sources.deleteTitle", { defaultValue: "Remove Source" })}
      >
        <p className="text-sm text-text-secondary mb-4">
          {t("knowledge.sources.deleteConfirm", {
            defaultValue:
              "Remove this connected source? Documents already synced will remain in the collection.",
          })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("common.remove", { defaultValue: "Remove" })}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
