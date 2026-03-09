import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Settings2,
  ArrowRight,
  Copy,
  Check,
  Trash2,
  LayoutList,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { formatDistanceToNow } from "date-fns";

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/_auth/research")({
  component: ResearchPage,
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
  type?: "query" | "source" | "analysis" | "synthesis" | "info";
  timestamp?: string;
  sourceUrl?: string;
}

interface ResearchConfig {
  maxSources: number;
  maxIterations: number;
  outputFormat?: "markdown" | "structured";
}

interface ResearchReport {
  id: string;
  query: string;
  status: "pending" | "running" | "completed" | "failed";
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

type OutputFormat = "markdown" | "structured";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function ResearchPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
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
      return d?.status === "running" || d?.status === "pending" ? 3_000 : false;
    },
  });

  const detail = reportDetail as ResearchReport | undefined;

  // ---- Mutations ----

  const startResearch = useMutation({
    mutationFn: (data: {
      query: string;
      maxSources: number;
      maxIterations: number;
      outputFormat?: OutputFormat;
    }) => api.post<ResearchReport>("/api/research", data),
    onSuccess: (data: any) => {
      toast(t("research.started", "Research task started"), "success");
      queryClient.invalidateQueries({ queryKey: ["research-reports"] });
      setSelectedReport(data.id);
      setShowNewForm(false);
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

  // ---- Handlers ----

  const handleRerun = useCallback(
    (report: ResearchReport) => {
      setRerunDialogReport(report);
    },
    [],
  );

  const handleRerunSubmit = useCallback(
    (params: { query: string; maxSources: number; maxIterations: number; outputFormat: OutputFormat }) => {
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
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("research.title", "Deep Research")}
            </h2>
            <Button
              variant={showNewForm ? "ghost" : "primary"}
              size="sm"
              onClick={() => setShowNewForm((v) => !v)}
            >
              {showNewForm ? t("common.cancel", "Cancel") : t("research.new", "New")}
            </Button>
          </div>

          {showNewForm && (
            <NewResearchForm
              onSubmit={(data) => startResearch.mutate(data)}
              isPending={startResearch.isPending}
            />
          )}
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="space-y-1 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
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
            <div className="text-center py-12 px-4">
              <XCircle className="h-10 w-10 mx-auto mb-3 text-danger opacity-60" aria-hidden="true" />
              <p className="text-sm text-danger">{t("research.loadError", "Failed to load research reports")}</p>
              <p className="text-xs text-text-tertiary mt-1">{t("common.tryAgain", "Please try again later.")}</p>
            </div>
          )}

          {reports.length === 0 && !isLoading && !isError && (
            <div className="text-center py-12 px-4">
              <BookOpen className="h-10 w-10 mx-auto mb-3 text-text-tertiary opacity-40" aria-hidden="true" />
              <p className="text-sm text-text-tertiary">{t("research.empty", "No research reports yet.")}</p>
              <p className="text-xs text-text-tertiary mt-1">
                {t("research.emptyHint", 'Click "New" above to start your first research.')}
              </p>
            </div>
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
          />
        ) : (
          <EmptyDetailState onNew={() => setShowNewForm(true)} />
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
// New Research Form  (#77 & #81)
// ---------------------------------------------------------------------------

function NewResearchForm({
  onSubmit,
  isPending,
  defaultValues,
}: {
  onSubmit: (data: { query: string; maxSources: number; maxIterations: number; outputFormat: OutputFormat }) => void;
  isPending: boolean;
  defaultValues?: { query?: string; maxSources?: number; maxIterations?: number; outputFormat?: OutputFormat };
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(defaultValues?.query ?? "");
  const [maxSources, setMaxSources] = useState(defaultValues?.maxSources ?? 10);
  const [maxIterations, setMaxIterations] = useState(defaultValues?.maxIterations ?? 5);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(defaultValues?.outputFormat ?? "markdown");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) return;
    onSubmit({ query: query.trim(), maxSources, maxIterations, outputFormat });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-2">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">{t("research.queryLabel", "Research Query")}</label>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("research.queryPlaceholder", "What would you like to research in depth?")}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary text-sm resize-none field-glow transition-colors"
        />
        {query.length > 0 && query.trim().length < 3 && (
          <p className="text-xs text-danger mt-1">{t("research.queryMinLength", "Query must be at least 3 characters")}</p>
        )}
      </div>

      {/* Advanced settings toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs text-text-secondary hover:text-text transition-colors"
      >
        <Settings2 className="h-3 w-3" aria-hidden="true" />
        {t("research.advancedSettings", "Advanced settings")}
        {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {showAdvanced && (
        <div className="space-y-3 p-3 rounded-lg bg-surface-secondary border border-border">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-text-tertiary mb-1 flex items-center gap-1">
                <Globe className="h-3 w-3" aria-hidden="true" />
                {t("research.maxSources", "Max Sources")}
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxSources}
                onChange={(e) => setMaxSources(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-text text-xs field-glow"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-text-tertiary mb-1 flex items-center gap-1">
                <Zap className="h-3 w-3" aria-hidden="true" />
                {t("research.maxIterations", "Max Iterations")}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-text text-xs field-glow"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-tertiary mb-1 flex items-center gap-1">
              <LayoutList className="h-3 w-3" aria-hidden="true" />
              {t("research.outputFormat", "Output Format")}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOutputFormat("markdown")}
                className={`flex-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                  outputFormat === "markdown"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong"
                }`}
              >
                {t("research.formatMarkdown", "Markdown")}
              </button>
              <button
                type="button"
                onClick={() => setOutputFormat("structured")}
                className={`flex-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                  outputFormat === "structured"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong"
                }`}
              >
                {t("research.formatStructured", "Structured")}
              </button>
            </div>
          </div>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={query.trim().length < 3 || isPending}
        loading={isPending}
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        {isPending ? t("research.starting", "Starting...") : t("research.startResearch", "Start Research")}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Report list item
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
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 border-b border-border transition-colors ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-surface-secondary"
      }`}
    >
      <div className="flex items-start gap-2">
        <StatusIcon status={report.status} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text line-clamp-2 leading-snug">{report.query}</p>
          <div className="flex items-center gap-2 mt-1.5">
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
            <span className="text-[10px] text-text-tertiary">
              {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
            </span>
          </div>
          {report.config && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-text-tertiary flex items-center gap-0.5">
                <Globe className="h-2.5 w-2.5" />
                {report.config.maxSources}
              </span>
              <span className="text-[10px] text-text-tertiary flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                {report.config.maxIterations}
              </span>
            </div>
          )}
        </div>
      </div>
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
}: {
  report: ResearchReport;
  onRerun: (report: ResearchReport) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [copiedReport, setCopiedReport] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const progressEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll progress feed when running
  useEffect(() => {
    if (report.status === "running" && progressEndRef.current) {
      progressEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [report.progress, report.status]);

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
                <h1>${escapeHtml(report.query)}</h1>
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
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <StatusIcon status={report.status} />
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
          {report.config && (
            <span className="text-xs text-text-tertiary ml-2">
              {report.config.maxSources} sources / {report.config.maxIterations} iterations
              {report.config.outputFormat ? ` / ${report.config.outputFormat}` : ""}
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold text-text">{report.query}</h2>
        <p className="text-xs text-text-tertiary mt-1">
          Started {new Date(report.createdAt).toLocaleString()}
          {report.completedAt && ` | Completed ${new Date(report.completedAt).toLocaleString()}`}
        </p>
      </div>

      {/* ---- Live progress feed (#78) ---- */}
      {(report.status === "running" || report.status === "pending") && (
        <ProgressFeed
          status={report.status}
          progress={report.progress}
          progressEndRef={progressEndRef}
        />
      )}

      {/* ---- Error state ---- */}
      {report.status === "failed" && (
        <div className="p-4 rounded-xl bg-danger/5 border border-danger/20">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
            <span className="text-sm font-medium text-danger">{t("research.failed", "Research failed")}</span>
          </div>
          <p className="text-xs text-text-secondary">
            {report.error ?? "An unexpected error occurred. Please try again."}
          </p>
        </div>
      )}

      {/* ---- Report content (#79) ---- */}
      {report.reportContent && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text">Report</h3>
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text transition-colors"
            >
              {copiedReport ? <Check className="h-3 w-3 text-success" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
              {copiedReport ? t("common.copied", "Copied") : t("common.copy", "Copy")}
            </button>
          </div>
          <div className="rounded-xl bg-surface border border-border overflow-hidden">
            <div className="px-5 py-4 text-sm text-text leading-relaxed">
              <RenderedMarkdown content={report.reportContent} />
            </div>
          </div>
        </div>
      )}

      {/* ---- Structured report sections ---- */}
      {report.structuredReport && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">
            {report.structuredReport.title}
          </h3>

          {report.structuredReport.summary && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-4">
              <p className="text-sm text-text-secondary">{report.structuredReport.summary}</p>
            </div>
          )}

          <div className="space-y-2">
            {report.structuredReport.sections.map((section, idx) => (
              <div key={idx} className="rounded-xl bg-surface border border-border overflow-hidden">
                <button
                  onClick={() => toggleSection(idx)}
                  className="w-full flex items-center gap-2 p-4 text-left hover:bg-surface-secondary transition-colors"
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
                  <div className="px-4 pb-4 border-t border-border">
                    <div className="pt-3 text-sm text-text-secondary leading-relaxed">
                      <RenderedMarkdown content={section.content} />
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
              </div>
            ))}
          </div>

          {report.structuredReport.conclusion && (
            <div className="mt-4 p-4 rounded-xl bg-surface border border-border">
              <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Conclusion
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                {report.structuredReport.conclusion}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- Sources / Citations (#79) ---- */}
      {report.sources && report.sources.length > 0 && (
        <SourcesList sources={report.sources} />
      )}

      {/* ---- Action bar (#80, #82) ---- */}
      {(report.status === "completed" || report.status === "failed") && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          {/* Re-run (#82) */}
          <Button variant="secondary" size="sm" onClick={() => onRerun(report)}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("research.rerun", "Re-run with different parameters")}
          </Button>

          {/* Export buttons (#80) */}
          {report.status === "completed" && (
            <>
              <div className="h-5 w-px bg-border mx-1" />
              <span className="text-xs text-text-tertiary mr-1">{t("research.export", "Export")}:</span>
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
  progressEndRef,
}: {
  status: string;
  progress?: ProgressStep[];
  progressEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const steps = progress ?? [];

  const stepIcon = (type?: string) => {
    switch (type) {
      case "query":
        return <Search className="h-3 w-3 text-primary" />;
      case "source":
        return <Globe className="h-3 w-3 text-success" />;
      case "analysis":
        return <Zap className="h-3 w-3 text-warning" />;
      case "synthesis":
        return <FileText className="h-3 w-3 text-primary" />;
      default:
        return <Hash className="h-3 w-3 text-text-tertiary" />;
    }
  };

  return (
    <div className="rounded-xl bg-primary/5 border border-primary/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/10">
        {status === "pending" ? (
          <Clock className="h-4 w-4 text-text-tertiary" />
        ) : (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        )}
        <span className="text-sm font-medium text-primary">
          {status === "pending" ? "Waiting to start..." : "Research in progress..."}
        </span>
        {steps.length > 0 && (
          <span className="text-xs text-text-tertiary ml-auto">{steps.length} steps</span>
        )}
      </div>

      {steps.length > 0 && (
        <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">{stepIcon(step.type)}</div>
              <div className="min-w-0 flex-1">
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
                <span className="text-[10px] text-text-tertiary shrink-0">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          ))}
          <div ref={progressEndRef} />
        </div>
      )}

      {steps.length === 0 && status === "running" && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-primary/20 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-primary animate-pulse" />
            </div>
            <span className="text-[10px] text-text-tertiary">Initializing...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources list (#79 - citations)
// ---------------------------------------------------------------------------

function SourcesList({ sources }: { sources: ResearchSource[] }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 5);

  return (
    <div>
      <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
        <Globe className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
        {t("research.sources", "Sources")} ({sources.length})
      </h3>
      <div className="space-y-2">
        {visible.map((source, i) => (
          <div
            key={i}
            className="p-3 rounded-lg bg-surface border border-border hover:border-border-strong transition-colors"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xs font-mono text-text-tertiary bg-surface-secondary rounded px-1.5 py-0.5 shrink-0">
                {i + 1}
              </span>
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
                  <div className="mt-1.5 flex items-center gap-1">
                    <div className="h-1 w-16 rounded-full bg-surface-tertiary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round(source.relevance * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-text-tertiary">
                      {Math.round(source.relevance * 100)}% relevant
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {sources.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {showAll ? t("common.showLess", "Show less") : t("research.showAllSources", "Show all {{count}} sources", { count: sources.length })}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
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
  onSubmit: (params: { query: string; maxSources: number; maxIterations: number; outputFormat: OutputFormat }) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onClose={onClose} title={t("research.rerunTitle", "Re-run Research")} className="max-w-md">
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
        }}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Empty detail state
// ---------------------------------------------------------------------------

function EmptyDetailState({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-full text-text-tertiary">
      <div className="text-center">
        <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" aria-hidden="true" />
        <p className="text-sm font-medium text-text-secondary">{t("research.selectOrStart", "Select a report or start new research")}</p>
        <p className="text-xs text-text-tertiary mt-1 max-w-xs mx-auto">
          {t("research.description", "Deep research performs multi-step web research, visiting multiple sources and synthesizing a comprehensive report.")}
        </p>
        <Button variant="primary" size="sm" className="mt-4" onClick={onNew}>
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          {t("research.startResearch", "Start Research")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status icon helper
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Clock className="h-3.5 w-3.5 text-text-tertiary shrink-0 mt-0.5" />;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0 mt-0.5" />;
    case "completed":
      return <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-danger shrink-0 mt-0.5" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Minimal Markdown renderer
// ---------------------------------------------------------------------------

function RenderedMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";

  const processInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Normalize HTML line breaks to newlines, then split on them
    const normalized = text.replace(/<br\s*\/?>/gi, "\n");
    if (normalized.includes("\n")) {
      const segments = normalized.split("\n");
      return segments.flatMap((seg, idx) => [
        ...(idx > 0 ? [<br key={`br-${idx}`} />] : []),
        ...processInline(seg),
      ]);
    }
    // Bold, italic, inline code, links, citation references
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[([^\]]+)\]\(([^)]+)\))|(\[(\d+)\])/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      if (match[1]) {
        // Bold
        parts.push(<strong key={match.index} className="font-semibold text-text">{match[2]}</strong>);
      } else if (match[3]) {
        // Italic
        parts.push(<em key={match.index}>{match[4]}</em>);
      } else if (match[5]) {
        // Inline code
        parts.push(
          <code key={match.index} className="px-1 py-0.5 rounded bg-surface-tertiary text-xs font-mono">
            {match[6]}
          </code>,
        );
      } else if (match[7]) {
        // Link
        parts.push(
          <a
            key={match.index}
            href={match[9]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {match[8]}
          </a>,
        );
      } else if (match[10]) {
        // Citation reference [N]
        parts.push(
          <span
            key={match.index}
            className="inline-flex items-center px-1 py-0 rounded bg-primary/10 text-primary text-[10px] font-mono align-super cursor-default"
            title={`Source ${match[11]}`}
          >
            {match[10]}
          </span>,
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={i} className="px-4 py-3 rounded-lg bg-surface-tertiary overflow-x-auto text-xs font-mono my-2">
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold text-text mt-4 mb-1">
          {processInline(line.slice(4))}
        </h4>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold text-text mt-5 mb-2">
          {processInline(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-text mt-6 mb-2">
          {processInline(line.slice(2))}
        </h2>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-text-secondary">
          {processInline(line.slice(2))}
        </li>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <li key={i} className="ml-4 list-decimal text-text-secondary">
          {processInline(content)}
        </li>,
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-primary/40 pl-3 my-2 text-text-secondary italic">
          {processInline(line.slice(2))}
        </blockquote>,
      );
    } else if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      // Markdown table: collect consecutive pipe-delimited rows
      const tableRows: string[] = [line];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|") && lines[i + 1].trim().endsWith("|")) {
        i++;
        tableRows.push(lines[i]);
      }
      const parsedRows = tableRows
        .filter((r) => !/^\|[\s\-:|]+\|$/.test(r.trim())) // skip separator rows
        .map((r) =>
          r.split("|").slice(1, -1).map((cell) => cell.trim()),
        );
      const [header, ...body] = parsedRows;
      elements.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">
            {header && (
              <thead>
                <tr className="border-b border-border">
                  {header.map((cell, ci) => (
                    <th key={ci} className="px-3 py-2 text-left font-semibold text-text">
                      {processInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-b border-border/50">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-text-secondary">
                      {processInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (line.startsWith("---") || line.startsWith("***")) {
      elements.push(<hr key={i} className="my-4 border-border" />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-text-secondary leading-relaxed">
          {processInline(line)}
        </p>,
      );
    }
  }

  return <>{elements}</>;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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
