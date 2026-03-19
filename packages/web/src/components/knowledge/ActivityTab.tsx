import {
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  FileText,
  Trash2,
  Plus,
  Settings2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { formatRelativeTime } from "../../lib/format";
import type { KnowledgeDocument, HistoryEntry } from "./types";

interface ActivityTabProps {
  collectionId: string;
  documents: KnowledgeDocument[];
  totalChunks: number;
  collectionStatus: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: typeof Plus }> = {
  "knowledge.collection.create": { label: "Collection created", icon: Plus },
  "knowledge.collection.update": { label: "Collection updated", icon: Settings2 },
  "knowledge.document.create": { label: "Document added", icon: Plus },
  "knowledge.document.delete": { label: "Document removed", icon: Trash2 },
  "knowledge.document.index": { label: "Document indexed", icon: RefreshCw },
  "knowledge.collection.reindex": { label: "Re-index started", icon: RefreshCw },
};

function getActionDisplay(action: string) {
  const match = ACTION_LABELS[action];
  if (match) return match;
  // Fallback: humanize the action key
  const label = action.split(".").pop()?.replace(/_/g, " ") ?? action;
  return { label: label.charAt(0).toUpperCase() + label.slice(1), icon: FileText };
}

export function ActivityTab({ collectionId, documents, totalChunks, collectionStatus }: ActivityTabProps) {
  const { t } = useTranslation();

  const { data: historyData } = useQuery({
    queryKey: [...queryKeys.knowledge.detail(collectionId), "history"],
    queryFn: () => api.get<{ data: HistoryEntry[]; total: number }>(`/api/knowledge/${collectionId}/history`),
  });

  const history: HistoryEntry[] = (historyData as any)?.data ?? [];

  return (
    <div className="max-w-3xl space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary mb-1">{t("knowledge.documents", { defaultValue: "Documents" })}</p>
          <p className="text-2xl font-semibold text-text">{documents.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary mb-1">{t("knowledge.totalChunks", { defaultValue: "Total Chunks" })}</p>
          <p className="text-2xl font-semibold text-text">{totalChunks}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary mb-1">{t("knowledge.status", { defaultValue: "Status" })}</p>
          <p className="text-2xl font-semibold text-text capitalize">{collectionStatus}</p>
        </div>
      </div>

      {/* Indexing status per document */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">{t("knowledge.docIndexingStatus", { defaultValue: "Document Indexing Status" })}</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-text-tertiary">{t("knowledge.noDocsToIndex", { defaultValue: "No documents to index." })}</p>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded border border-border bg-surface">
                <div className="flex items-center gap-2 min-w-0">
                  {doc.status === "ready" ? (
                    <CheckCircle className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                  ) : doc.status === "indexing" ? (
                    <RefreshCw className="h-4 w-4 text-primary animate-spin shrink-0" aria-hidden="true" />
                  ) : doc.status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-danger shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
                  )}
                  <span className="text-sm text-text truncate">{doc.title ?? t("knowledge.untitled", { defaultValue: "Untitled" })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">{doc.chunkCount ?? 0} {t("knowledge.chunks", { defaultValue: "chunks" })}</span>
                  <Badge
                    variant={
                      doc.status === "ready" ? "success"
                        : doc.status === "indexing" ? "warning"
                          : doc.status === "error" ? "danger"
                            : "default"
                    }
                  >
                    {doc.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History timeline */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">{t("knowledge.history", { defaultValue: "History" })}</h3>
        {history.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-7 w-7" />}
            title={t("knowledge.noHistory", { defaultValue: "No activity yet" })}
            description={t("knowledge.noHistoryDesc", { defaultValue: "Activity will appear here as documents are added, updated, or indexed." })}
          />
        ) : (
          <div className="space-y-0">
            {history.map((entry, idx) => {
              const { label, icon: Icon } = getActionDisplay(entry.action);
              const isLast = idx === history.length - 1;
              return (
                <div key={entry.id} className="flex gap-3">
                  {/* Timeline line + dot */}
                  <div className="flex flex-col items-center">
                    <div className="h-7 w-7 rounded-full bg-surface-secondary flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border" />}
                  </div>
                  {/* Content */}
                  <div className="pb-4 pt-0.5 min-w-0">
                    <p className="text-sm text-text">{label}</p>
                    {entry.details && (entry.details as any).documentTitle && (
                      <p className="text-xs text-text-secondary truncate">{(entry.details as any).documentTitle}</p>
                    )}
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {formatRelativeTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
