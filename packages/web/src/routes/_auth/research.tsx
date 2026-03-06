import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, BookOpen, Play, Clock, CheckCircle, XCircle, Loader2, ExternalLink, Download, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { toast } from "../../components/ui/Toast";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/research")({
  component: ResearchPage,
});

function ResearchPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [maxSources, setMaxSources] = useState(10);
  const [maxIterations, setMaxIterations] = useState(3);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ["research-reports"],
    queryFn: () => api.get<any>("/api/research"),
    refetchInterval: 10_000,
  });

  const { data: reportDetail } = useQuery({
    queryKey: ["research-reports", selectedReport],
    queryFn: () => api.get<any>(`/api/research/${selectedReport}`),
    enabled: !!selectedReport,
    refetchInterval: (data: any) => (data?.status === "running" || data?.status === "pending") ? 5_000 : false,
  });

  const startResearch = useMutation({
    mutationFn: (data: { query: string; maxSources: number; maxIterations: number }) =>
      api.post<any>("/api/research", data),
    onSuccess: (data: any) => {
      toast.success("Research started");
      queryClient.invalidateQueries({ queryKey: ["research-reports"] });
      setSelectedReport(data.id);
      setQuery("");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to start research"),
  });

  const reports = (reportsData as any)?.data ?? [];
  const detail = reportDetail as any;

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-3.5 w-3.5 text-text-tertiary" />;
      case "running": return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
      case "completed": return <CheckCircle className="h-3.5 w-3.5 text-success" />;
      case "failed": return <XCircle className="h-3.5 w-3.5 text-danger" />;
      default: return null;
    }
  };

  return (
    <div className="flex h-full">
      {/* Left panel - Reports list */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-text mb-3">Deep Research</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim().length >= 3) startResearch.mutate({ query, maxSources, maxIterations });
            }}
            className="space-y-3"
          >
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like to research?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary text-sm resize-none"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-text-tertiary mb-1">Sources</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxSources}
                  onChange={(e) => setMaxSources(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded border border-border bg-surface text-text text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-tertiary mb-1">Iterations</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded border border-border bg-surface text-text text-xs"
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={query.trim().length < 3 || startResearch.isPending}
            >
              <Search className="h-3.5 w-3.5" />
              {startResearch.isPending ? "Starting..." : "Start Research"}
            </Button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto">
          {reports.map((report: any) => (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id)}
              className={`w-full text-left p-3 border-b border-border transition-colors ${
                selectedReport === report.id ? "bg-primary/5" : "hover:bg-surface-secondary"
              }`}
            >
              <div className="flex items-start gap-2">
                {statusIcon(report.status)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text line-clamp-2">{report.query}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={report.status === "completed" ? "success" : report.status === "failed" ? "danger" : "default"}
                    >
                      {report.status}
                    </Badge>
                    <span className="text-xs text-text-tertiary">
                      {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}

          {reports.length === 0 && !isLoading && (
            <div className="text-center py-8 text-sm text-text-tertiary">
              No research reports yet. Start your first research above.
            </div>
          )}
        </div>
      </div>

      {/* Right panel - Report detail */}
      <div className="flex-1 overflow-y-auto">
        {detail ? (
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {statusIcon(detail.status)}
                <Badge
                  variant={detail.status === "completed" ? "success" : detail.status === "failed" ? "danger" : "default"}
                >
                  {detail.status}
                </Badge>
              </div>
              <h2 className="text-lg font-semibold text-text">{detail.query}</h2>
              <p className="text-xs text-text-tertiary mt-1">
                Started {new Date(detail.createdAt).toLocaleString()}
                {detail.config && ` | Sources: ${detail.config.maxSources} | Iterations: ${detail.config.maxIterations}`}
              </p>
            </div>

            {detail.status === "running" && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  <span className="text-sm font-medium text-primary">Research in progress...</span>
                </div>
                {detail.progress && (
                  <div className="space-y-1 text-xs text-text-secondary">
                    {(detail.progress as any[]).map((step: any, i: number) => (
                      <p key={i}>{step.message}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detail.report && (
              <div className="prose prose-sm max-w-none">
                <div className="px-4 py-3 rounded-xl bg-surface-secondary border border-border text-sm text-text whitespace-pre-wrap">
                  {detail.report}
                </div>
              </div>
            )}

            {detail.sources && (detail.sources as any[]).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text mb-3">Sources ({(detail.sources as any[]).length})</h3>
                <div className="space-y-2">
                  {(detail.sources as any[]).map((source: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-surface-secondary border border-border">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-text-tertiary">[{i + 1}]</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text">{source.title}</p>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {source.url} <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                          {source.snippet && (
                            <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{source.snippet}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.status === "completed" && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => {
                  startResearch.mutate({ query: detail.query, maxSources, maxIterations });
                }}>
                  <RefreshCw className="h-3.5 w-3.5" /> Re-run
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  const blob = new Blob([detail.report ?? ""], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `research-${detail.id}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="h-3.5 w-3.5" /> Export Markdown
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <div className="text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a report or start new research</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
