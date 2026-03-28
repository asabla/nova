import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  Activity,
  Settings,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Play,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

export const Route = createFileRoute("/_auth/admin/evals")({
  component: AdminEvalsPage,
});

type Tab = "overview" | "runs" | "prompts" | "optimizations" | "settings";

interface EvalAggregate {
  evalType: string;
  periodStart: string;
  avgScore: string | null;
  evalCount: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
}

interface EvalRun {
  id: string;
  messageId: string;
  evalType: string;
  executionTier: string | null;
  overallScore: string | null;
  scores: Record<string, number> | null;
  reasoning: string | null;
  judgeModel: string | null;
  status: string;
  createdAt: string;
}

interface SystemPrompt {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  activeVersion: { version: number; avgScore: string | null; evalCount: number } | null;
}

interface PromptVersion {
  id: string;
  version: number;
  content: string;
  generatedBy: string;
  status: string;
  trafficPct: number;
  evalCount: number;
  avgScore: string | null;
  createdAt: string;
}

interface OptimizationRun {
  id: string;
  systemPromptId: string;
  triggerReason: string;
  analysisReasoning: string | null;
  proposedVersionId: string | null;
  status: string;
  model: string | null;
  createdAt: string;
}

function AdminEvalsPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Quality Overview", icon: BarChart3 },
    { id: "runs", label: "Eval Runs", icon: Activity },
    { id: "prompts", label: "System Prompts", icon: FileText },
    { id: "optimizations", label: "Optimizations", icon: Sparkles },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quality Evaluation</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Monitor response quality, manage system prompts, and track self-improvement.
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <QualityOverview />}
      {tab === "runs" && <EvalRunsTab />}
      {tab === "prompts" && <SystemPromptsTab />}
      {tab === "optimizations" && <OptimizationsTab />}
      {tab === "settings" && <EvalSettingsTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quality Overview
// ---------------------------------------------------------------------------

function QualityOverview() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["evals-dashboard"],
    queryFn: () => api.get<{ aggregates: EvalAggregate[]; stats: { totalEvals: number; avgScore: string | null; completedCount: number } }>("/api/evals/dashboard"),
    staleTime: 60_000,
  });

  const { data: trends } = useQuery({
    queryKey: ["evals-trends", "7d"],
    queryFn: () => api.get<EvalAggregate[]>("/api/evals/trends?period=7d"),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="text-sm text-[var(--color-text-secondary)]">Loading quality data...</div>;
  }

  const avgScore = dashboard?.stats?.avgScore ? parseFloat(dashboard.stats.avgScore) : null;
  const scorePercent = avgScore !== null ? Math.round(avgScore * 100) : null;

  // Group aggregates by eval type
  const byType = new Map<string, EvalAggregate[]>();
  for (const agg of dashboard?.aggregates ?? []) {
    const list = byType.get(agg.evalType) ?? [];
    list.push(agg);
    byType.set(agg.evalType, list);
  }

  return (
    <div className="space-y-6">
      {/* Headline metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Overall Quality (7d)"
          value={scorePercent !== null ? `${scorePercent}%` : "N/A"}
          trend={null}
        />
        <MetricCard
          label="Evals Completed (7d)"
          value={String(dashboard?.stats?.completedCount ?? 0)}
          trend={null}
        />
        <MetricCard
          label="Total Evals"
          value={String(dashboard?.stats?.totalEvals ?? 0)}
          trend={null}
        />
      </div>

      {/* Per-type breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Quality by Mode</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["chat", "planning", "research"].map((type) => {
            const aggs = byType.get(type) ?? [];
            const scores = aggs.map((a) => parseFloat(a.avgScore ?? "0")).filter(Boolean);
            const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
            return (
              <div key={type} className="rounded-lg border border-[var(--color-border)] p-4">
                <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">{type}</div>
                <div className="text-2xl font-semibold mt-1">
                  {avg !== null ? `${Math.round(avg * 100)}%` : "N/A"}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {aggs.reduce((s, a) => s + a.evalCount, 0)} evals
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trends chart (simple text-based for now) */}
      {trends && (trends as EvalAggregate[]).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">7-Day Trend</h3>
          <div className="flex items-end gap-1 h-24">
            {(trends as EvalAggregate[]).map((agg, i) => {
              const score = parseFloat(agg.avgScore ?? "0");
              const height = Math.max(4, score * 100);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${height}%`,
                    backgroundColor: score >= 0.7 ? "var(--color-success)" : score >= 0.5 ? "var(--color-warning)" : "var(--color-error)",
                    opacity: 0.7,
                  }}
                  title={`${new Date(agg.periodStart).toLocaleDateString()}: ${Math.round(score * 100)}%`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, trend }: { label: string; value: string; trend: "up" | "down" | null }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4">
      <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-2xl font-semibold">{value}</span>
        {trend === "up" && <TrendingUp size={16} className="text-green-500" />}
        {trend === "down" && <TrendingDown size={16} className="text-red-500" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Eval Runs
// ---------------------------------------------------------------------------

function EvalRunsTab() {
  const [evalType, setEvalType] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["evals-runs", evalType],
    queryFn: () => api.get<{ data: EvalRun[]; pagination: any }>(
      `/api/evals/runs?pageSize=50${evalType ? `&evalType=${evalType}` : ""}`,
    ),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["", "chat", "planning", "research"].map((type) => (
          <button
            key={type}
            onClick={() => setEvalType(type)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              evalType === type
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)]"
            }`}
          >
            {type || "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-[var(--color-text-secondary)]">Loading...</div>
      ) : (
        <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          {(data?.data ?? []).map((run) => (
            <div key={run.id}>
              <button
                onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                {expandedId === run.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <ScoreBadge score={run.overallScore} />
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-secondary)]">{run.evalType}</span>
                {run.executionTier && (
                  <span className="text-xs text-[var(--color-text-secondary)]">{run.executionTier}</span>
                )}
                <span className="text-xs text-[var(--color-text-secondary)] ml-auto">
                  {new Date(run.createdAt).toLocaleString()}
                </span>
                <StatusBadge status={run.status} />
              </button>
              {expandedId === run.id && (
                <div className="px-4 py-3 bg-[var(--color-bg-secondary)] text-sm space-y-2">
                  {run.reasoning && <p>{run.reasoning}</p>}
                  {run.scores && (
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(run.scores).map(([dim, score]) => (
                        <span key={dim} className="text-xs">
                          <span className="text-[var(--color-text-secondary)]">{dim}:</span>{" "}
                          <span className="font-medium">{Math.round((score as number) * 100)}%</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {run.judgeModel && (
                    <p className="text-xs text-[var(--color-text-secondary)]">Judge: {run.judgeModel}</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {(data?.data ?? []).length === 0 && (
            <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
              No eval runs yet. Evals are created automatically when messages are completed.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: string | null }) {
  if (!score) return <span className="text-xs text-[var(--color-text-secondary)]">--</span>;
  const pct = Math.round(parseFloat(score) * 100);
  const color = pct >= 70 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600";
  return <span className={`text-sm font-semibold tabular-nums ${color}`}>{pct}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// System Prompts
// ---------------------------------------------------------------------------

function SystemPromptsTab() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["evals-prompts"],
    queryFn: () => api.get<SystemPrompt[]>("/api/evals/prompts"),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-sm text-[var(--color-text-secondary)]">Loading...</div>
      ) : (
        <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          {(prompts ?? []).map((sp) => (
            <div key={sp.id}>
              <button
                onClick={() => setSelectedSlug(selectedSlug === sp.slug ? null : sp.slug)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                {selectedSlug === sp.slug ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <div className="flex-1">
                  <div className="text-sm font-medium">{sp.name}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{sp.slug}</div>
                </div>
                {sp.activeVersion && (
                  <div className="text-right">
                    <div className="text-xs">
                      v{sp.activeVersion.version} &middot;{" "}
                      {sp.activeVersion.avgScore ? `${Math.round(parseFloat(sp.activeVersion.avgScore) * 100)}%` : "N/A"}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{sp.activeVersion.evalCount} evals</div>
                  </div>
                )}
              </button>
              {selectedSlug === sp.slug && <PromptVersionList slug={sp.slug} />}
            </div>
          ))}
          {(prompts ?? []).length === 0 && (
            <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
              No system prompts configured. Run the seed script to populate defaults.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PromptVersionList({ slug }: { slug: string }) {
  const queryClient = useQueryClient();

  const { data: versions } = useQuery({
    queryKey: ["evals-prompt-versions", slug],
    queryFn: () => api.get<PromptVersion[]>(`/api/evals/prompts/${slug}/versions`),
    staleTime: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: (versionId: string) => api.post(`/api/evals/prompts/${slug}/versions/${versionId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals-prompt-versions", slug] });
      toast.success("Version approved and set to 20% traffic for A/B testing.");
    },
  });

  const deployMutation = useMutation({
    mutationFn: (versionId: string) => api.post(`/api/evals/prompts/${slug}/versions/${versionId}/deploy`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals-prompt-versions", slug] });
      queryClient.invalidateQueries({ queryKey: ["evals-prompts"] });
      toast.success("Version deployed as active.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (versionId: string) => api.post(`/api/evals/prompts/${slug}/versions/${versionId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals-prompt-versions", slug] });
      toast.success("Version rejected.");
    },
  });

  return (
    <div className="px-4 py-3 bg-[var(--color-bg-secondary)] space-y-2">
      {(versions ?? []).map((v) => (
        <div key={v.id} className="flex items-center gap-3 p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">v{v.version}</span>
              <VersionStatusBadge status={v.status} />
              <span className="text-xs text-[var(--color-text-secondary)]">{v.generatedBy}</span>
              {v.trafficPct > 0 && v.status === "testing" && (
                <span className="text-xs text-[var(--color-text-secondary)]">{v.trafficPct}% traffic</span>
              )}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1 truncate">{v.content.slice(0, 120)}...</div>
            {v.avgScore && (
              <div className="text-xs mt-1">
                Score: <span className="font-medium">{Math.round(parseFloat(v.avgScore) * 100)}%</span>
                <span className="text-[var(--color-text-secondary)]"> ({v.evalCount} evals)</span>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            {v.status === "draft" && (
              <>
                <button
                  onClick={() => approveMutation.mutate(v.id)}
                  className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600"
                  title="Approve (start A/B test)"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => rejectMutation.mutate(v.id)}
                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                  title="Reject"
                >
                  <X size={14} />
                </button>
              </>
            )}
            {v.status === "testing" && (
              <button
                onClick={() => deployMutation.mutate(v.id)}
                className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"
                title="Deploy as active"
              >
                <Play size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
      {(versions ?? []).length === 0 && (
        <div className="text-xs text-[var(--color-text-secondary)]">No versions found.</div>
      )}
    </div>
  );
}

function VersionStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    testing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    retired: "bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[status] ?? ""}`}>{status}</span>
  );
}

// ---------------------------------------------------------------------------
// Optimizations
// ---------------------------------------------------------------------------

function OptimizationsTab() {
  const queryClient = useQueryClient();
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("");

  const { data: optimizations, isLoading } = useQuery({
    queryKey: ["evals-optimizations"],
    queryFn: () => api.get<OptimizationRun[]>("/api/evals/optimizations"),
    staleTime: 30_000,
  });

  const { data: prompts } = useQuery({
    queryKey: ["evals-prompts"],
    queryFn: () => api.get<SystemPrompt[]>("/api/evals/prompts"),
    staleTime: 60_000,
  });

  const triggerMutation = useMutation({
    mutationFn: (slug: string) => api.post("/api/evals/optimizations", { slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals-optimizations"] });
      setShowTriggerDialog(false);
      setSelectedSlug("");
      toast.success("Optimization workflow started.");
    },
    onError: () => toast.error("Failed to start optimization."),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Prompt Optimization History</h3>
        <button
          onClick={() => setShowTriggerDialog(true)}
          className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          Trigger Manual Optimization
        </button>
      </div>

      <Dialog
        open={showTriggerDialog}
        onClose={() => { setShowTriggerDialog(false); setSelectedSlug(""); }}
        title="Trigger Prompt Optimization"
        size="sm"
      >
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Select a system prompt to analyze and optimize. The system will review low-scoring outputs and generate an improved version for your approval.
        </p>
        <select
          value={selectedSlug}
          onChange={(e) => setSelectedSlug(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] mb-4"
        >
          <option value="">Select a prompt...</option>
          {(prompts ?? []).map((sp) => (
            <option key={sp.slug} value={sp.slug}>{sp.name} ({sp.slug})</option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setShowTriggerDialog(false); setSelectedSlug(""); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selectedSlug}
            loading={triggerMutation.isPending}
            onClick={() => { if (selectedSlug) triggerMutation.mutate(selectedSlug); }}
          >
            Start Optimization
          </Button>
        </div>
      </Dialog>

      {isLoading ? (
        <div className="text-sm text-[var(--color-text-secondary)]">Loading...</div>
      ) : (
        <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          {(optimizations ?? []).map((opt) => (
            <div key={opt.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={opt.status} />
                <span className="text-sm">{opt.triggerReason.replace(/_/g, " ")}</span>
                <span className="text-xs text-[var(--color-text-secondary)] ml-auto">
                  {new Date(opt.createdAt).toLocaleString()}
                </span>
              </div>
              {opt.analysisReasoning && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">{opt.analysisReasoning}</p>
              )}
            </div>
          ))}
          {(optimizations ?? []).length === 0 && (
            <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
              No optimization runs yet. They are triggered automatically when quality drops below threshold.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function EvalSettingsTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["evals-settings"],
    queryFn: () => api.get<Record<string, string>>("/api/evals/settings"),
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (updates: Record<string, string>) => api.put("/api/evals/settings", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals-settings"] });
      toast.success("Settings saved.");
    },
  });

  const [localSettings, setLocalSettings] = useState<Record<string, string> | null>(null);
  const current = localSettings ?? settings ?? {};

  const fields: { key: string; label: string; type: "toggle" | "number" | "percent" }[] = [
    { key: "eval_enabled", label: "Enable evaluations", type: "toggle" },
    { key: "eval_sample_rate", label: "Sample rate (0.0 - 1.0)", type: "percent" },
    { key: "eval_auto_optimize", label: "Auto-optimize prompts", type: "toggle" },
    { key: "eval_score_threshold_chat", label: "Chat quality threshold", type: "percent" },
    { key: "eval_score_threshold_planning", label: "Planning quality threshold", type: "percent" },
    { key: "eval_score_threshold_research", label: "Research quality threshold", type: "percent" },
    { key: "eval_ab_test_min_samples", label: "Min A/B test samples", type: "number" },
    { key: "eval_optimization_cooldown_hours", label: "Optimization cooldown (hours)", type: "number" },
  ];

  if (isLoading) return <div className="text-sm text-[var(--color-text-secondary)]">Loading...</div>;

  return (
    <div className="space-y-6 max-w-xl">
      {fields.map(({ key, label, type }) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <label className="text-sm">{label}</label>
          {type === "toggle" ? (
            <button
              onClick={() => {
                const next = { ...current, [key]: current[key] === "true" ? "false" : "true" };
                setLocalSettings(next);
              }}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                current[key] === "true" ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  current[key] === "true" ? "translate-x-5" : ""
                }`}
              />
            </button>
          ) : (
            <input
              type="text"
              value={current[key] ?? ""}
              onChange={(e) => setLocalSettings({ ...current, [key]: e.target.value })}
              className="w-24 text-right text-sm px-2 py-1 rounded border border-[var(--color-border)] bg-transparent"
            />
          )}
        </div>
      ))}

      <button
        onClick={() => {
          if (localSettings) saveMutation.mutate(localSettings);
        }}
        disabled={!localSettings}
        className="px-4 py-2 text-sm rounded bg-[var(--color-primary)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        Save Settings
      </button>
    </div>
  );
}
