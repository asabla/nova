import { useState } from "react";
import { FileText, Globe, Clock, Layers, ChevronDown, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { Badge } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { formatRelativeTime } from "../../lib/format";
import type { KnowledgeDocument, KnowledgeChunk } from "./types";

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface DocumentPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  document: KnowledgeDocument | null;
}

export function DocumentPreviewDialog({ open, onClose, collectionId, document }: DocumentPreviewDialogProps) {
  const { t } = useTranslation();
  const [chunksOpen, setChunksOpen] = useState(false);

  const { data: chunksData, isLoading: chunksLoading } = useQuery({
    queryKey: [...queryKeys.knowledge.detail(collectionId), "chunks", document?.id],
    queryFn: () => api.get<{ data: KnowledgeChunk[] }>(`/api/knowledge/${collectionId}/documents/${document!.id}/chunks`),
    enabled: open && !!document,
  });

  const chunks: KnowledgeChunk[] = (chunksData as any)?.data ?? [];
  const reconstructedContent = chunks
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map((c) => c.content)
    .join("\n\n");

  if (!document) return null;

  return (
    <Dialog open={open} onClose={onClose} title={document.title ?? t("knowledge.untitled", { defaultValue: "Untitled" })} size="lg">
      {/* Metadata header */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          {document.sourceUrl ? (
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {document.sourceUrl ? (
            <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]">
              {document.sourceUrl}
            </a>
          ) : (
            <span>{t("knowledge.uploadedFile", { defaultValue: "Uploaded file" })}</span>
          )}
        </div>
        <Badge
          variant={
            document.status === "ready" ? "success"
              : document.status === "indexing" ? "warning"
                : document.status === "error" ? "danger"
                  : "default"
          }
        >
          {document.status}
        </Badge>
        {document.tokenCount != null && (
          <span className="text-xs text-text-tertiary">{document.tokenCount.toLocaleString()} {t("knowledge.tokens", { defaultValue: "tokens" })}</span>
        )}
        <span className="text-xs text-text-tertiary flex items-center gap-1">
          <Layers className="h-3 w-3" aria-hidden="true" />
          {document.chunkCount ?? 0} {t("knowledge.chunks", { defaultValue: "chunks" })}
        </span>
        <span className="text-xs text-text-tertiary flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {formatRelativeTime(document.createdAt)}
        </span>
      </div>

      {/* Reconstructed content */}
      {chunksLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : reconstructedContent ? (
        <div className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-surface-secondary p-4">
          <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{reconstructedContent}</p>
        </div>
      ) : (
        <p className="text-sm text-text-tertiary text-center py-8">
          {document.status === "pending"
            ? t("knowledge.pendingIndexing", { defaultValue: "Document is pending indexing." })
            : t("knowledge.noContent", { defaultValue: "No content available." })}
        </p>
      )}

      {/* Collapsible chunks section */}
      {chunks.length > 0 && (
        <details
          open={chunksOpen}
          onToggle={(e) => setChunksOpen((e.target as HTMLDetailsElement).open)}
          className="mt-4"
        >
          <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-xs text-text-secondary hover:text-text">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${chunksOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
            {t("knowledge.viewChunks", { defaultValue: "View individual chunks" })} ({chunks.length})
          </summary>
          <div className="space-y-2 mt-2 max-h-60 overflow-auto">
            {chunks.map((chunk) => {
              const meta = chunk.metadata as Record<string, unknown> | undefined;
              const timestampUrl = meta?.timestampUrl as string | undefined;
              const startTimeMs = meta?.startTimeMs as number | undefined;
              const endTimeMs = meta?.endTimeMs as number | undefined;
              const chapterTitle = meta?.chapterTitle as string | undefined;

              return (
                <div key={chunk.id} className="rounded border border-border bg-surface px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-tertiary">
                        {t("knowledge.chunkNumber", { defaultValue: "Chunk" })} #{chunk.chunkIndex}
                      </span>
                      {startTimeMs != null && (
                        timestampUrl ? (
                          <a
                            href={timestampUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80 transition-colors"
                          >
                            <Play className="h-3 w-3" aria-hidden="true" />
                            {formatTimestamp(startTimeMs)}
                            {endTimeMs != null && <span className="text-text-tertiary">– {formatTimestamp(endTimeMs)}</span>}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-text-secondary">
                            <Play className="h-3 w-3" aria-hidden="true" />
                            {formatTimestamp(startTimeMs)}
                            {endTimeMs != null && <span>– {formatTimestamp(endTimeMs)}</span>}
                          </span>
                        )
                      )}
                      {chapterTitle && (
                        <span className="text-xs text-text-secondary truncate max-w-[200px]">{chapterTitle}</span>
                      )}
                    </div>
                    {chunk.tokenCount != null && (
                      <span className="text-xs text-text-tertiary">{chunk.tokenCount} {t("knowledge.tokens", { defaultValue: "tokens" })}</span>
                    )}
                  </div>
                  <p className="text-sm text-text whitespace-pre-wrap line-clamp-4">{chunk.content}</p>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </Dialog>
  );
}
