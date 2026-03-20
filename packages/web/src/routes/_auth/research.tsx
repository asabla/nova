import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Search,
  BookOpen,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Download,
  RefreshCw,
  FileText,
  FileJson,
  FileType,
  ChevronDown,
  ChevronRight,
  Globe,
  Zap,
  Hash,
  ArrowRight,
  Copy,
  Check,
  Trash2,
  Database,
  FileIcon,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { EmptyState } from "../../components/ui/EmptyState";
import { Dialog } from "../../components/ui/Dialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { formatDistanceToNow } from "date-fns";
import { NewResearchForm, type NewResearchFormSubmitData } from "../../components/research/NewResearchForm";
import { useResearchSSE } from "../../hooks/useResearchSSE";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { MarkdownRenderer } from "../../components/markdown/MarkdownRenderer";

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/_auth/research")({
  component: () => (
    <ErrorBoundary>
      <ResearchPage />
    </ErrorBoundary>
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResearchSource {
  title: string;
  url: string;
  snippet?: string;
  relevance?: number;
}

interface ProgressStep {
  message: string;
  type?: "query" | "source" | "analysis" | "synthesis" | "info" | "error";
  timestamp?: string;
  sourceUrl?: string;
}

interface ResearchConfig {
  maxSources: number;
  maxIterations: number;
  outputFormat?: "markdown" | "structured";
  sources?: {
    webSearch: boolean;
    knowledgeCollectionIds: string[];
    fileIds: string[];
  };
}

interface ResearchReport {
  id: string;
  query: string;
  title?: string;
  status: "pending" | "queued" | "running" | "searching" | "analyzing" | "generating" | "completed" | "failed" | "cancelled";
  config: ResearchConfig;
  reportContent?: string;
  structuredReport?: {
    title: string;
    summary: string;
    sections: { heading: string; content: string; citations: number[] }[];
    conclusion: string;
  };
  sources?: ResearchSource[];
  progress?: ProgressStep[];
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function ResearchPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [rerunDialogReport, setRerunDialogReport] = useState<ResearchReport | null>(null);

  // ---- Data fetching ----

  const { data: reportsData, isLoading, isError } = useQuery({
    queryKey: ["research-reports"],
    queryFn: () => api.get<{ data: ResearchReport[] }>("/api/research"),
    refetchInterval: 10_000,
  });

  const reports: ResearchReport[] = (reportsData as any)?.data ?? [];

  const { data: reportDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["research-reports", selectedReport],
    queryFn: () => api.get<ResearchReport>(`/api/research/${selectedReport}`),
    enabled: !!selectedReport,
    refetchInterval: (query) => {
      const d = query.state.data as ResearchReport | undefined;
      const active = d?.status === "running" || d?.status === "pending" || d?.status === "queued" ||
        d?.status === "searching" || d?.status === "analyzing" || d?.status === "generating";
      // With SSE, we need less frequent polling (just for reconnection fallback)
      return active ? 10_000 : false;
    },
  });

  const detail = reportDetail as ResearchReport | undefined;

  // ---- Mutations ----

  const startResearch = useMutation({
    mutationFn: (data: NewResearchFormSubmitData) =>
      api.post<ResearchReport>("/api/research", data),
    onSuccess: (data: any) => {
      toast(t("research.started", "Research task started"), "success");
      queryClient.invalidateQueries({ queryKey: ["research-reports"] });
      setSelectedReport(data.id);
    },
    onError: (err: any) => toast(err.message ?? t("research.startFailed", "Failed to start research"), "error"),
  });

  const deleteReport = useMutation({
    mutationFn: (id: string) => api.delete(`/api/research/${id}`),
    onSuccess: () => {
      toast(t("research.deleted", "Report deleted"), "success");
      queryClient.invalidateQueries({ queryKey: ["research-reports"] });
      setSelectedReport(null);
    },
    onError: () => toast(t("research.deleteFailed", "Failed to delete report"), "error"),
  });

  const renameReport = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch<ResearchReport>(`/api/research/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-reports"] });
      if (selectedReport) {
        queryClient.invalidateQueries({ queryKey: ["research-reports", selectedReport] });
      }
    },
    onError: () => toast(t("research.renameFailed", "Failed to rename report"), "error"),
  });

  // ---- Handlers ----

  const handleRerun = useCallback(
    (report: ResearchReport) => {
      setRerunDialogReport(report);
    },
    [],
  );

  const handleRerunSubmit = useCallback(
    (params: NewResearchFormSubmitData) => {
      startResearch.mutate(params);
      setRerunDialogReport(null);
    },
    [startResearch],
  );

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* ------------------------------------------------------------------ */}
      {/* Left panel - History & new research form                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-full md:w-80 max-h-[40vh] md:max-h-none border-b md:border-b-0 md:border-r border-border flex flex-col bg-surface">
        {/* Gradient accent strip */}
        <div className="h-[3px] bg-gradient-to-r from-primary via-primary/70 to-primary/40 shrink-0" />

        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Search className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              </div>
              {t("research.title", "Deep Research")}
            </h2>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSelectedReport(null)}
            >
              {t("research.new", "New")}
            </Button>
          </div>
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading && (
            <div className="space-y-1 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {reports.map((report) => (
            <ReportListItem
              key={report.id}
              report={report}
              isSelected={selectedReport === report.id}
              onSelect={() => setSelectedReport(report.id)}
            />
          ))}

          {isError && (
            <Card className="mx-2 border-danger/20">
              <CardContent className="text-center py-8">
                <div className="h-10 w-10 rounded-lg bg-danger/10 flex items-center justify-center mx-auto mb-3">
                  <XCircle className="h-5 w-5 text-danger" aria-hidden="true" />
                </div>
                <p className="text-sm text-danger">{t("research.loadError", "Failed to load research reports")}</p>
                <p className="text-xs text-text-tertiary mt-1">{t("common.tryAgain", "Please try again later.")}</p>
              </CardContent>
            </Card>
          )}

          {reports.length === 0 && !isLoading && !isError && (
            <EmptyState
              icon={<BookOpen className="h-8 w-8" />}
              title={t("research.empty", "No research reports yet.")}
              description={t("research.emptyHint", 'Click "New" above to start your first research.')}
            />
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right panel - Report detail                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto bg-surface-secondary/30">
        {isDetailLoading && selectedReport ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : detail ? (
          <ReportDetail
            report={detail}
            onRerun={handleRerun}
            onDelete={(id) => deleteReport.mutate(id)}
            onRename={(id, title) => renameReport.mutate({ id, title })}
          />
        ) : (
          <EmptyDetailState
            onSubmit={(data) => startResearch.mutate(data)}
            isPending={startResearch.isPending}
          />
        )}
      </div>

      {/* Re-run dialog */}
      {rerunDialogReport && (
        <RerunDialog
          report={rerunDialogReport}
          onClose={() => setRerunDialogReport(null)}
          onSubmit={handleRerunSubmit}
          isPending={startResearch.isPending}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status icon helper — icon box style
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: string }) {
  const config = {
    pending: { bg: "bg-surface-tertiary", icon: <Clock className="h-3.5 w-3.5 text-text-tertiary" /> },
    queued: { bg: "bg-surface-tertiary", icon: <Clock className="h-3.5 w-3.5 text-text-tertiary" /> },
    running: { bg: "bg-primary/10", icon: <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /> },
    searching: { bg: "bg-primary/10", icon: <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /> },
    analyzing: { bg: "bg-warning/10", icon: <Loader2 className="h-3.5 w-3.5 text-warning animate-spin" /> },
    generating: { bg: "bg-primary/10", icon: <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /> },
    completed: { bg: "bg-success/10", icon: <CheckCircle className="h-3.5 w-3.5 text-success" /> },
    failed: { bg: "bg-danger/10", icon: <XCircle className="h-3.5 w-3.5 text-danger" /> },
    cancelled: { bg: "bg-surface-tertiary", icon: <XCircle className="h-3.5 w-3.5 text-text-tertiary" /> },
  }[status] ?? { bg: "bg-surface-tertiary", icon: <Clock className="h-3.5 w-3.5 text-text-tertiary" /> };

  return (
    <div className={clsx("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
      {config.icon}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source-type mini-badges
// ---------------------------------------------------------------------------

function SourceBadges({ config }: { config: ResearchConfig }) {
  if (!config.sources) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {config.sources.webSearch && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
          <Globe className="h-2.5 w-2.5" />Web
        </span>
      )}
      {config.sources.knowledgeCollectionIds?.length > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-success bg-success/10 rounded-full px-1.5 py-0.5">
          <Database className="h-2.5 w-2.5" />{config.sources.knowledgeCollectionIds.length}
        </span>
      )}
      {config.sources.fileIds?.length > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning bg-warning/10 rounded-full px-1.5 py-0.5">
          <FileIcon className="h-2.5 w-2.5" />{config.sources.fileIds.length}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Report list item — card-style
// ---------------------------------------------------------------------------

function ReportListItem({
  report,
  isSelected,
  onSelect,
}: {
  report: ResearchReport;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const displayTitle = report.title ?? report.query;

  return (
    <button
      onClick={onSelect}
      className={clsx(
        "w-full text-left p-3 rounded-lg mx-2 my-1 border transition-all",
        isSelected
          ? "bg-primary/5 border-primary/20 ring-1 ring-primary/20"
          : "border-transparent hover:bg-surface-secondary",
      )}
      style={{ width: "calc(100% - 16px)" }}
    >
      <div className="flex items-start gap-2.5">
        <StatusIcon status={report.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-text line-clamp-2 leading-snug">{displayTitle}</p>
            <span className="text-[10px] text-text-tertiary shrink-0 mt-0.5">
              {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge
              variant={
                report.status === "completed"
                  ? "success"
                  : report.status === "failed"
                    ? "danger"
                    : report.status === "running"
                      ? "primary"
                      : "default"
              }
            >
              {report.status}
            </Badge>
            {report.config && <SourceBadges config={report.config} />}
          </div>
        </div>
      </div>
      {report.status === "running" && (
        <div className="mt-2 ml-9">
          <ProgressBar indeterminate size="sm" />
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Report detail  (#78, #79, #80)
// ---------------------------------------------------------------------------

function ReportDetail({
  report,
  onRerun,
  onDelete,
  onRename,
}: {
  report: ResearchReport;
  onRerun: (report: ResearchReport) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const [copiedReport, setCopiedReport] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(report.title ?? report.query);
  const progressEndRef = useRef<HTMLDivElement>(null);

  // Real-time SSE for active research reports
  const sse = useResearchSSE(report.id, report.status);

  // Surface SSE errors to user
  useEffect(() => {
    if (sse.error) {
      toast(sse.error, "error");
    }
  }, [sse.error]);

  // Merge SSE progress events with any existing report.progress
  const isActive = report.status === "pending" || report.status === "searching" ||
    report.status === "analyzing" || report.status === "generating" || report.status === "running";
  const liveProgress: ProgressStep[] = isActive && sse.progress.length > 0
    ? sse.progress.map((p) => ({
        message: p.message,
        type: p.type as ProgressStep["type"],
        timestamp: p.timestamp,
        sourceUrl: p.sourceUrl,
      }))
    : report.progress ?? [];

  const displayTitle = report.title ?? report.query;

  // Auto-scroll progress feed when running
  useEffect(() => {
    if (isActive && progressEndRef.current) {
      progressEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveProgress, isActive]);

  // Sync title draft when report changes
  useEffect(() => {
    setTitleDraft(report.title ?? report.query);
    setIsEditingTitle(false);
  }, [report.id, report.title, report.query]);

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleCopyReport = useCallback(() => {
    const text = report.reportContent ?? "";
    navigator.clipboard.writeText(text).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    });
  }, [report.reportContent]);

  const handleTitleSave = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== displayTitle) {
      onRename(report.id, trimmed);
    }
    setIsEditingTitle(false);
  };

  const handleExport = useCallback(
    (format: "pdf" | "docx" | "json" | "markdown") => {
      if (format === "markdown") {
        downloadBlob(report.reportContent ?? "", `research-${report.id}.md`, "text/markdown");
        return;
      }

      if (format === "json") {
        const json = JSON.stringify(
          {
            id: report.id,
            query: report.query,
            title: report.title,
            status: report.status,
            config: report.config,
            report: report.reportContent,
            structuredReport: report.structuredReport,
            sources: report.sources,
            createdAt: report.createdAt,
            completedAt: report.completedAt,
          },
          null,
          2,
        );
        downloadBlob(json, `research-${report.id}.json`, "application/json");
        return;
      }

      // PDF and DOCX - attempt server-side export, fallback to client
      const apiUrl = import.meta.env.VITE_API_URL ?? "";
      const exportUrl = `${apiUrl}/api/research/${report.id}/export?format=${format}`;

      fetch(exportUrl, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Export not available");
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `research-${report.id}.${format}`;
          a.click();
          URL.revokeObjectURL(url);
        })
        .catch(() => {
          if (format === "pdf") {
            // Fallback: open print dialog for PDF
            const printWindow = window.open("", "_blank");
            if (printWindow) {
              printWindow.document.write(`
                <html><head><title>Research Report</title>
                <style>body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
                h1 { font-size: 1.5rem; } h2 { font-size: 1.25rem; margin-top: 1.5rem; }
                pre { background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
                .source { padding: 0.5rem; border-left: 3px solid #ddd; margin: 0.5rem 0; }
                </style></head><body>
                <h1>${escapeHtml(report.title ?? report.query)}</h1>
                <div>${markdownToBasicHtml(report.reportContent ?? "")}</div>
                ${
                  report.sources?.length
                    ? `<h2>Sources</h2>${report.sources
                        .map(
                          (s, i) =>
                            `<div class="source"><strong>[${i + 1}]</strong> ${escapeHtml(s.title)}<br/><a href="${escapeHtml(s.url)}">${escapeHtml(s.url)}</a></div>`,
                        )
                        .join("")}`
                    : ""
                }
                </body></html>
              `);
              printWindow.document.close();
              printWindow.print();
            }
          } else {
            toast(`${format.toUpperCase()} export is not available from the server`, "warning");
          }
        });
    },
    [report],
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header card */}
      <Card>
        <div className="h-[3px] bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {/* Inline-editable title */}
              {isEditingTitle ? (
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") { setTitleDraft(displayTitle); setIsEditingTitle(false); }
                  }}
                  className="text-lg font-semibold text-text bg-transparent border-b-2 border-primary outline-none w-full"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2 group">
                  <h2 className="text-lg font-semibold text-text">{displayTitle}</h2>
                  {report.status === "completed" && (
                    <button
                      onClick={() => { setTitleDraft(displayTitle); setIsEditingTitle(true); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-tertiary"
                      title={t("research.editTitle", "Edit title")}
                    >
                      <Pencil className="h-3.5 w-3.5 text-text-tertiary" />
                    </button>
                  )}
                </div>
              )}

              {/* Show query as metadata when title differs */}
              {report.title && report.title !== report.query && (
                <QueryMeta query={report.query} />
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge
                  variant={
                    report.status === "completed"
                      ? "success"
                      : report.status === "failed"
                        ? "danger"
                        : report.status === "running"
                          ? "primary"
                          : "default"
                  }
                >
                  {report.status}
                </Badge>
                {report.config?.sources && <SourceBadges config={report.config} />}
                <span className="text-xs text-text-tertiary">
                  {report.config.maxSources} sources / {report.config.maxIterations} iterations
                  {report.config.outputFormat ? ` / ${report.config.outputFormat}` : ""}
                </span>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-3 mt-3 text-xs text-text-tertiary flex items-center gap-4">
            <span>{t("research.started", "Started")} {new Date(report.createdAt).toLocaleString()}</span>
            {report.completedAt && <span>{t("research.completed", "Completed")} {new Date(report.completedAt).toLocaleString()}</span>}
          </div>
        </CardHeader>
      </Card>

      {/* ---- Live progress feed (#78) ---- */}
      {isActive && (
        <ProgressFeed
          status={sse.status !== "idle" ? sse.status : report.status}
          progress={liveProgress}
          activeTools={sse.activeTools}
          progressEndRef={progressEndRef}
        />
      )}

      {/* ---- Error state ---- */}
      {report.status === "failed" && (
        <Card className="border-danger/20">
          <CardContent className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
              <XCircle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
            </div>
            <div>
              <span className="text-sm font-medium text-danger">{t("research.failed", "Research failed")}</span>
              <p className="text-xs text-text-secondary mt-0.5">
                {report.error ?? "An unexpected error occurred. Please try again."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Report content (#79) ---- */}
      {report.reportContent && (
        <Card>
          <CardHeader bordered className="flex flex-row items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-text flex-1">{t("research.report", "Report")}</span>
            <Button variant="ghost" size="sm" onClick={handleCopyReport}>
              {copiedReport ? <Check className="h-3 w-3 text-success" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
              {copiedReport ? t("common.copied", "Copied") : t("common.copy", "Copy")}
            </Button>
          </CardHeader>
          <CardContent>
            <CitationLinkWrapper>
              <div className="text-sm text-text leading-relaxed">
                <MarkdownRenderer content={linkifyCitations(report.reportContent)} />
              </div>
            </CitationLinkWrapper>
          </CardContent>
        </Card>
      )}

      {/* ---- Streaming report preview ---- */}
      {isActive && sse.streamingContent && (
        <Card className="border-primary/20">
          <CardHeader bordered className="flex flex-row items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-text flex-1">{t("research.generating", "Generating Report...")}</span>
            <Badge variant="primary">{t("research.live", "Live")}</Badge>
          </CardHeader>
          <CardContent>
            <CitationLinkWrapper>
              <div className="text-sm text-text leading-relaxed">
                <MarkdownRenderer content={linkifyCitations(sse.streamingContent)} />
              </div>
            </CitationLinkWrapper>
          </CardContent>
        </Card>
      )}

      {/* ---- Structured report sections ---- */}
      {report.structuredReport && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent>
              <h3 className="text-sm font-semibold text-text mb-1">
                {report.structuredReport.title}
              </h3>
              <p className="text-sm text-text-secondary">{report.structuredReport.summary}</p>
            </CardContent>
          </Card>

          {/* Collapsible sections */}
          <div className="space-y-2">
            {report.structuredReport.sections.map((section, idx) => (
              <Card key={idx}>
                <button
                  onClick={() => toggleSection(idx)}
                  className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-surface-secondary/50 transition-colors"
                >
                  {expandedSections.has(idx) ? (
                    <ChevronDown className="h-4 w-4 text-text-tertiary shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
                  )}
                  <span className="text-sm font-medium text-text">{section.heading}</span>
                  {section.citations.length > 0 && (
                    <span className="text-[10px] text-text-tertiary ml-auto">
                      {section.citations.length} citation{section.citations.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </button>
                {expandedSections.has(idx) && (
                  <div className="px-5 pb-4 border-t border-border">
                    <div className="pt-3 text-sm text-text-secondary leading-relaxed">
                      <MarkdownRenderer content={section.content} />
                    </div>
                    {section.citations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {section.citations.map((num) => (
                          <span
                            key={num}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono"
                          >
                            [{num}]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Conclusion */}
          {report.structuredReport.conclusion && (
            <Card className="border-l-2 border-l-primary">
              <CardContent>
                <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  Conclusion
                </h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {report.structuredReport.conclusion}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ---- Sources / Citations (#79) ---- */}
      {report.sources && report.sources.length > 0 && (
        <SourcesList sources={report.sources} />
      )}

      {/* ---- Action bar (#80, #82) ---- */}
      {(report.status === "completed" || report.status === "failed") && (
        <Card>
          <div className="px-5 py-3 flex flex-wrap items-center gap-2">
            {/* Re-run (#82) */}
            <Button variant="secondary" size="sm" onClick={() => onRerun(report)}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {t("research.rerun", "Re-run with different parameters")}
            </Button>

            {/* Export buttons (#80) */}
            {report.status === "completed" && (
              <>
                <div className="h-5 w-px bg-border mx-1" />
                <div className="rounded-lg bg-surface-secondary p-1 inline-flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleExport("pdf")}>
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleExport("docx")}>
                    <FileType className="h-3.5 w-3.5" aria-hidden="true" />
                    DOCX
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleExport("json")}>
                    <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                    JSON
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleExport("markdown")}>
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("research.formatMarkdown", "Markdown")}
                  </Button>
                </div>
              </>
            )}

            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => {
              if (window.confirm(t("research.confirmDelete", "Delete this research report? This cannot be undone."))) {
                onDelete(report.id);
              }
            }} className="text-danger">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("common.delete", "Delete")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Query metadata with truncation
// ---------------------------------------------------------------------------

function QueryMeta({ query }: { query: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = query.length > 150;
  const display = isLong && !expanded ? query.slice(0, 150) + "..." : query;

  return (
    <div className="mt-2">
      <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">Query</span>
      <p className="text-sm text-text-secondary mt-0.5">{display}</p>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline mt-0.5">
          {expanded ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Feed  (#78)
// ---------------------------------------------------------------------------

function ProgressFeed({
  status,
  progress,
  activeTools,
  progressEndRef,
}: {
  status: string;
  progress?: ProgressStep[];
  activeTools?: { name: string; args?: Record<string, unknown>; startedAt: string }[];
  progressEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const steps = progress ?? [];

  const stepConfig: Record<string, { bg: string; icon: React.ReactNode }> = {
    query: { bg: "bg-primary/10", icon: <Search className="h-3 w-3 text-primary" /> },
    source: { bg: "bg-success/10", icon: <Globe className="h-3 w-3 text-success" /> },
    analysis: { bg: "bg-warning/10", icon: <Zap className="h-3 w-3 text-warning" /> },
    synthesis: { bg: "bg-primary/10", icon: <FileText className="h-3 w-3 text-primary" /> },
    info: { bg: "bg-surface-tertiary", icon: <Hash className="h-3 w-3 text-text-tertiary" /> },
    error: { bg: "bg-danger/10", icon: <XCircle className="h-3 w-3 text-danger" /> },
  };

  return (
    <Card className="border-primary/20">
      <CardHeader bordered className="flex flex-row items-center gap-2 py-3">
        {status === "pending" ? (
          <div className="h-7 w-7 rounded-lg bg-surface-tertiary flex items-center justify-center">
            <Clock className="h-3.5 w-3.5 text-text-tertiary" />
          </div>
        ) : (
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          </div>
        )}
        <span className="text-sm font-medium text-primary flex-1">
          {status === "pending" || status === "queued"
            ? "Waiting to start..."
            : status === "searching"
              ? "Searching sources..."
              : status === "analyzing"
                ? "Analyzing sources..."
                : status === "generating"
                  ? "Generating report..."
                  : "Research in progress..."}
        </span>
        {steps.length > 0 && <Badge variant="primary">{steps.length} steps</Badge>}
      </CardHeader>

      <CardContent className="py-3">
        {steps.length > 0 ? (
          <div className="max-h-64 overflow-y-auto space-y-0">
            {steps.map((step, i) => {
              const cfg = stepConfig[step.type ?? "info"] ?? stepConfig.info;
              return (
                <div key={i} className="flex items-start gap-3 relative">
                  <div className="flex flex-col items-center">
                    <div className={clsx("h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10", cfg.bg)}>
                      {cfg.icon}
                    </div>
                    {i < steps.length - 1 && <div className="w-px h-full min-h-[16px] bg-border" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <p className="text-xs text-text-secondary leading-snug">{step.message}</p>
                    {step.sourceUrl && (
                      <a
                        href={step.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5"
                      >
                        {step.sourceUrl}
                        <ExternalLink className="h-2 w-2" />
                      </a>
                    )}
                  </div>
                  {step.timestamp && (
                    <span className="text-[10px] text-text-tertiary shrink-0 mt-0.5">
                      {new Date(step.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                  )}
                </div>
              );
            })}
            {/* Active tool indicators */}
            {activeTools && activeTools.length > 0 && activeTools.map((t, i) => (
              <div key={`active-${i}`} className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10 bg-primary/10">
                    <Loader2 className="h-3 w-3 text-primary animate-spin" />
                  </div>
                </div>
                <div className="min-w-0 flex-1 pb-3">
                  <p className="text-xs text-primary font-medium leading-snug">{t.name}</p>
                </div>
              </div>
            ))}
            <div ref={progressEndRef} />
          </div>
        ) : (
          status !== "pending" && status !== "queued" && (
            <div className="flex items-center gap-2">
              <ProgressBar indeterminate size="sm" className="flex-1" />
              <span className="text-[10px] text-text-tertiary">Initializing...</span>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sources list (#79 - citations) — card-wrapped with ProgressBar
// ---------------------------------------------------------------------------

function SourcesList({ sources }: { sources: ResearchSource[] }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 5);

  return (
    <Card>
      <CardHeader bordered className="flex flex-row items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold text-text flex-1">
          {t("research.sources", "Sources")} ({sources.length})
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((source, i) => (
          <div
            key={i}
            id={`source-${i + 1}`}
            className="p-3 rounded-xl bg-surface border border-border hover:border-border-strong transition-colors scroll-mt-4"
          >
            <div className="flex items-start gap-2.5">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary text-xs font-mono">{i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text leading-snug">{source.title}</p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                >
                  {truncateUrl(source.url)}
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
                {source.snippet && (
                  <p className="text-xs text-text-tertiary mt-1.5 line-clamp-2 leading-relaxed">
                    {source.snippet}
                  </p>
                )}
                {source.relevance != null && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={source.relevance * 100} size="sm" className="w-20" />
                    <span className="text-[10px] text-text-tertiary">
                      {Math.round(source.relevance * 100)}% relevant
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {sources.length > 5 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t("common.showLess", "Show less") : t("research.showAllSources", "Show all {{count}} sources", { count: sources.length })}
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Re-run dialog (#82)
// ---------------------------------------------------------------------------

function RerunDialog({
  report,
  onClose,
  onSubmit,
  isPending,
}: {
  report: ResearchReport;
  onClose: () => void;
  onSubmit: (params: NewResearchFormSubmitData) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onClose={onClose} title={t("research.rerunTitle", "Re-run Research")} className="max-w-lg">
      <p className="text-xs text-text-secondary mb-4">
        {t("research.rerunDescription", "Adjust the parameters below and re-run this research task.")}
      </p>
      <NewResearchForm
        onSubmit={onSubmit}
        isPending={isPending}
        defaultValues={{
          query: report.query,
          maxSources: report.config?.maxSources ?? 10,
          maxIterations: report.config?.maxIterations ?? 5,
          outputFormat: report.config?.outputFormat ?? "markdown",
          sources: report.config?.sources ?? {
            webSearch: true,
            knowledgeCollectionIds: [],
            fileIds: [],
          },
        }}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Empty detail state
// ---------------------------------------------------------------------------

function EmptyDetailState({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: NewResearchFormSubmitData) => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-lg p-5">
        <NewResearchForm onSubmit={onSubmit} isPending={isPending} />
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Convert [N] citation references to markdown links that scroll to the source */
function linkifyCitations(content: string): string {
  return content.replace(/\[(\d+)\]/g, '[[$1](#source-$1)]');
}

/**
 * Wrapper that intercepts clicks on #source-N anchor links and scrolls
 * to the corresponding source element instead of navigating.
 */
function CitationLinkWrapper({ children }: { children: React.ReactNode }) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href?.startsWith("#source-")) return;
    e.preventDefault();
    const el = document.getElementById(href.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Flash highlight
      el.classList.add("ring-2", "ring-primary/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 1500);
    }
  }, []);

  return <div onClick={handleClick}>{children}</div>;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function truncateUrl(url: string, maxLen = 60): string {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 30) + "..." : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url.slice(0, maxLen) + "...";
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToBasicHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n/g, "<br/>");
}
