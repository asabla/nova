import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
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
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NewResearchForm } from "@/components/research/NewResearchForm";

// ---------------------------------------------------------------------------
// Types (mirrored from research.tsx)
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
// Mock data
// ---------------------------------------------------------------------------

const mockSources: ResearchSource[] = [
  {
    title: "Attention Is All You Need - Original Transformer Paper",
    url: "https://arxiv.org/abs/1706.03762",
    snippet:
      "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
    relevance: 0.97,
  },
  {
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    url: "https://arxiv.org/abs/1810.04805",
    snippet:
      "We introduce BERT, a new language representation model which is designed to pre-train deep bidirectional representations from unlabeled text.",
    relevance: 0.89,
  },
  {
    title: "GPT-4 Technical Report - OpenAI",
    url: "https://cdn.openai.com/papers/gpt-4.pdf",
    snippet:
      "We report the development of GPT-4, a large-scale, multimodal model which can accept image and text inputs and produce text outputs.",
    relevance: 0.82,
  },
  {
    title: "Scaling Laws for Neural Language Models",
    url: "https://arxiv.org/abs/2001.08361",
    snippet:
      "We study empirical scaling laws for language model performance on the cross-entropy loss. The loss scales as a power-law with model size, dataset size, and compute.",
    relevance: 0.74,
  },
  {
    title: "Constitutional AI: Harmlessness from AI Feedback",
    url: "https://arxiv.org/abs/2212.08073",
    snippet:
      "We experiment with methods for training a harmless AI assistant through a process we call Constitutional AI (CAI).",
    relevance: 0.65,
  },
  {
    title: "LLaMA: Open and Efficient Foundation Language Models",
    url: "https://arxiv.org/abs/2302.13971",
    snippet:
      "We introduce LLaMA, a collection of foundation language models ranging from 7B to 65B parameters trained on publicly available datasets.",
    relevance: 0.58,
  },
  {
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    url: "https://arxiv.org/abs/2005.11401",
    snippet:
      "We explore a general-purpose fine-tuning recipe for retrieval-augmented generation (RAG) — models which combine pre-trained parametric and non-parametric memory.",
    relevance: 0.51,
  },
];

const mockProgress: ProgressStep[] = [
  { message: "Generating search queries...", type: "query", timestamp: "2026-03-13T10:30:00Z" },
  { message: 'Searching: "transformer architecture advances 2025"', type: "query", timestamp: "2026-03-13T10:30:02Z" },
  {
    message: "Found: Attention Is All You Need",
    type: "source",
    timestamp: "2026-03-13T10:30:05Z",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
  },
  {
    message: "Found: BERT Pre-training Paper",
    type: "source",
    timestamp: "2026-03-13T10:30:07Z",
    sourceUrl: "https://arxiv.org/abs/1810.04805",
  },
  { message: "Analyzing source content and extracting key findings...", type: "analysis", timestamp: "2026-03-13T10:30:12Z" },
  {
    message: "Found: GPT-4 Technical Report",
    type: "source",
    timestamp: "2026-03-13T10:30:15Z",
    sourceUrl: "https://cdn.openai.com/papers/gpt-4.pdf",
  },
  { message: "Cross-referencing claims across 3 sources...", type: "analysis", timestamp: "2026-03-13T10:30:20Z" },
  { message: "Synthesizing findings into report structure...", type: "synthesis", timestamp: "2026-03-13T10:30:28Z" },
];

const mockReports: ResearchReport[] = [
  {
    id: "r-001",
    query: "What are the latest advances in transformer architecture design and scaling?",
    title: "Transformer Architecture Advances in 2025",
    status: "completed",
    config: {
      maxSources: 15,
      maxIterations: 5,
      outputFormat: "structured",
      sources: { webSearch: true, knowledgeCollectionIds: ["kc-1", "kc-2"], fileIds: [] },
    },
    reportContent:
      "# Transformer Architecture Advances\n\nThe transformer architecture has undergone significant evolution since its introduction in 2017...\n\n## Key Developments\n\n**Attention Mechanisms**: Multi-head attention remains the core innovation, with recent work on sparse attention patterns enabling processing of much longer sequences [1].\n\n**Scaling Laws**: Research has established clear power-law relationships between model size, data, and performance [2]. Models continue to grow, with GPT-4 representing a significant leap in capability [3].\n\n## Emerging Trends\n\n- Mixture-of-Experts (MoE) architectures for efficient scaling\n- Multi-modal capabilities combining vision and language\n- Retrieval-augmented generation (RAG) for knowledge-grounding\n- Constitutional AI approaches for alignment\n\n> The transformer architecture has proven remarkably adaptable, serving as the foundation for virtually all frontier language models.\n\n## Conclusion\n\nTransformer architectures continue to dominate the landscape of large language models, with innovations in efficiency, scale, and multi-modal capabilities driving the field forward.",
    structuredReport: {
      title: "Transformer Architecture Advances in 2025",
      summary:
        "A comprehensive analysis of recent developments in transformer architecture design, scaling approaches, and emerging trends in large language model research.",
      sections: [
        {
          heading: "Attention Mechanism Evolution",
          content:
            "Multi-head attention remains the core innovation, with recent work on sparse attention patterns enabling processing of much longer sequences. Flash Attention and Ring Attention have become standard optimizations.",
          citations: [1, 2],
        },
        {
          heading: "Scaling Laws and Model Growth",
          content:
            "Research has established clear power-law relationships between model size, dataset size, and performance. The Chinchilla scaling laws suggest that many early models were significantly undertrained relative to their parameter count.",
          citations: [2, 3, 4],
        },
        {
          heading: "Emerging Architectures",
          content:
            "Mixture-of-Experts (MoE) architectures have emerged as a key approach for efficient scaling, allowing models to activate only a fraction of parameters for each input. State-space models like Mamba offer alternatives for long-sequence processing.",
          citations: [3, 5],
        },
      ],
      conclusion:
        "Transformer architectures continue to dominate the landscape of large language models. The next frontier lies in efficient scaling through MoE, improved long-context handling, and multi-modal integration.",
    },
    sources: mockSources,
    progress: mockProgress,
    createdAt: "2026-03-13T10:30:00Z",
    completedAt: "2026-03-13T10:32:45Z",
  },
  {
    id: "r-002",
    query: "Compare retrieval-augmented generation approaches for enterprise knowledge bases",
    status: "running",
    config: {
      maxSources: 20,
      maxIterations: 7,
      sources: { webSearch: true, knowledgeCollectionIds: ["kc-3"], fileIds: ["f-1", "f-2"] },
    },
    progress: mockProgress.slice(0, 5),
    createdAt: "2026-03-13T11:15:00Z",
  },
  {
    id: "r-003",
    query: "Impact of constitutional AI on model safety and alignment research",
    status: "failed",
    config: { maxSources: 10, maxIterations: 3, sources: { webSearch: true, knowledgeCollectionIds: [], fileIds: [] } },
    error: "Search service timeout after 3 retries. The external search provider did not respond within the configured time limit.",
    createdAt: "2026-03-13T09:00:00Z",
  },
  {
    id: "r-004",
    query: "Best practices for fine-tuning LLMs on domain-specific data",
    status: "pending",
    config: { maxSources: 12, maxIterations: 4 },
    createdAt: "2026-03-13T11:20:00Z",
  },
  {
    id: "r-005",
    query: "State of open-source LLM ecosystem: LLaMA, Mistral, and beyond",
    title: "Open-Source LLM Ecosystem Overview",
    status: "completed",
    config: {
      maxSources: 10,
      maxIterations: 5,
      outputFormat: "markdown",
      sources: { webSearch: true, knowledgeCollectionIds: [], fileIds: [] },
    },
    reportContent:
      "# Open-Source LLM Ecosystem\n\nThe open-source LLM landscape has evolved rapidly...\n\n## Key Players\n\n- **Meta LLaMA**: Ranges from 7B to 70B parameters\n- **Mistral**: Efficient MoE architectures\n- **Qwen**: Strong multilingual support\n\n## Impact\n\nOpen-source models have democratized access to powerful language models, enabling innovation across industries.",
    sources: mockSources.slice(0, 3),
    createdAt: "2026-03-12T14:00:00Z",
    completedAt: "2026-03-12T14:05:30Z",
  },
  {
    id: "r-006",
    query: "Neural architecture search for edge deployment",
    status: "queued",
    config: { maxSources: 8, maxIterations: 3, sources: { webSearch: true, knowledgeCollectionIds: [], fileIds: [] } },
    createdAt: "2026-03-13T11:30:00Z",
  },
  {
    id: "r-007",
    query: "Cancelled research: multi-agent coordination patterns",
    status: "cancelled",
    config: { maxSources: 10, maxIterations: 5 },
    progress: mockProgress.slice(0, 3),
    createdAt: "2026-03-13T10:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Redesigned sub-components
// ---------------------------------------------------------------------------

/** Icon box — rounded colored container for status icons */
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

/** Source-type mini-badges for list items */
function SourceBadges({ config }: { config: ResearchConfig }) {
  if (!config.sources) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {config.sources.webSearch && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
          <Globe className="h-2.5 w-2.5" />
          Web
        </span>
      )}
      {config.sources.knowledgeCollectionIds?.length > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-success bg-success/10 rounded-full px-1.5 py-0.5">
          <Database className="h-2.5 w-2.5" />
          {config.sources.knowledgeCollectionIds.length}
        </span>
      )}
      {config.sources.fileIds?.length > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning bg-warning/10 rounded-full px-1.5 py-0.5">
          <FileIcon className="h-2.5 w-2.5" />
          {config.sources.fileIds.length}
        </span>
      )}
    </div>
  );
}

/** Redesigned list item — card-style with source badges */
function ReportListItem({
  report,
  isSelected,
  onSelect,
}: {
  report: ResearchReport;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const timeAgo = formatTimeAgo(report.createdAt);
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
            <span className="text-[10px] text-text-tertiary shrink-0 mt-0.5">{timeAgo}</span>
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

/** Sidebar with gradient accent strip */
function ReportListSidebar({
  reports,
  selectedId,
  onSelect,
  onNew,
}: {
  reports: ResearchReport[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="w-80 border-r border-border flex flex-col bg-surface h-full">
      {/* Gradient accent strip */}
      <div className="h-[3px] bg-gradient-to-r from-primary via-primary/70 to-primary/40 shrink-0" />

      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-primary" />
            </div>
            Deep Research
          </h2>
          <Button variant="primary" size="sm" onClick={onNew}>
            New
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {reports.map((report) => (
          <ReportListItem
            key={report.id}
            report={report}
            isSelected={selectedId === report.id}
            onSelect={() => onSelect(report.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Inline-editable title */
function InlineEditTitle({
  value,
  onSave,
  editable,
}: {
  value: string;
  onSave: (newTitle: string) => void;
  editable: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") { setDraft(value); setIsEditing(false); }
        }}
        className="text-lg font-semibold text-text bg-transparent border-b-2 border-primary outline-none w-full"
        autoFocus
      />
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <h2 className="text-lg font-semibold text-text">{value}</h2>
      {editable && (
        <button
          onClick={() => { setDraft(value); setIsEditing(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-tertiary"
        >
          <Pencil className="h-3.5 w-3.5 text-text-tertiary" />
        </button>
      )}
    </div>
  );
}

/** Query metadata with truncation */
function QueryMeta({ query }: { query: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = query.length > 150;
  const display = isLong && !expanded ? query.slice(0, 150) + "..." : query;

  return (
    <div>
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

/** Progress feed with timeline styling */
function ProgressFeed({
  status,
  progress,
}: {
  status: string;
  progress?: ProgressStep[];
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
          {status === "pending" ? "Waiting to start..." : "Research in progress..."}
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
                  {/* Timeline connector */}
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
                      {new Date(step.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          status === "running" && (
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

/** Sources list with card wrapper and ProgressBar relevance */
function SourcesList({ sources }: { sources: ResearchSource[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 5);

  return (
    <Card>
      <CardHeader bordered className="flex flex-row items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold text-text flex-1">Sources ({sources.length})</span>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((source, i) => (
          <div
            key={i}
            className="p-3 rounded-xl bg-surface border border-border hover:border-border-strong transition-colors"
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
                  <p className="text-xs text-text-tertiary mt-1.5 line-clamp-2 leading-relaxed">{source.snippet}</p>
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
            {showAll ? "Show less" : `Show all ${sources.length} sources`}
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Action bar wrapped in card */
function ActionBar({ status }: { status: string }) {
  return (
    <Card>
      <div className="px-5 py-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => {}}>
          <RefreshCw className="h-3.5 w-3.5" />
          Re-run with different parameters
        </Button>

        {status === "completed" && (
          <>
            <div className="h-5 w-px bg-border mx-1" />
            <div className="rounded-lg bg-surface-secondary p-1 inline-flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => {}}>
                <FileText className="h-3.5 w-3.5" />
                PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {}}>
                <FileType className="h-3.5 w-3.5" />
                DOCX
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {}}>
                <FileJson className="h-3.5 w-3.5" />
                JSON
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {}}>
                <Download className="h-3.5 w-3.5" />
                Markdown
              </Button>
            </div>
          </>
        )}

        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-danger" onClick={() => {}}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </Card>
  );
}

/** Full report detail view — card-wrapped sections */
function ReportDetailView({ report }: { report: ResearchReport }) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [copiedReport, setCopiedReport] = useState(false);
  const [title, setTitle] = useState(report.title);

  const displayTitle = title ?? report.query;

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

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
              <InlineEditTitle
                value={displayTitle}
                onSave={(newTitle) => setTitle(newTitle)}
                editable={report.status === "completed"}
              />
              {(report.title || report.query !== displayTitle) && (
                <div className="mt-2">
                  <QueryMeta query={report.query} />
                </div>
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
            <span>Started {new Date(report.createdAt).toLocaleString()}</span>
            {report.completedAt && <span>Completed {new Date(report.completedAt).toLocaleString()}</span>}
          </div>
        </CardHeader>
      </Card>

      {/* Action bar */}
      {(report.status === "completed" || report.status === "failed") && <ActionBar status={report.status} />}

      {/* Progress feed (running/pending) */}
      {(report.status === "running" || report.status === "pending") && (
        <ProgressFeed status={report.status} progress={report.progress} />
      )}

      {/* Error state */}
      {report.status === "failed" && (
        <Card className="border-danger/20">
          <CardContent className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
              <XCircle className="h-3.5 w-3.5 text-danger" />
            </div>
            <div>
              <span className="text-sm font-medium text-danger">Research failed</span>
              <p className="text-xs text-text-secondary mt-0.5">
                {report.error ?? "An unexpected error occurred. Please try again."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report content */}
      {report.reportContent && (
        <Card>
          <CardHeader bordered className="flex flex-row items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-text flex-1">Report</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCopiedReport(true);
                setTimeout(() => setCopiedReport(false), 2000);
              }}
            >
              {copiedReport ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copiedReport ? "Copied" : "Copy"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">
              {report.reportContent}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Structured report sections */}
      {report.structuredReport && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent>
              <h3 className="text-sm font-semibold text-text mb-1">{report.structuredReport.title}</h3>
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
                    <div className="pt-3 text-sm text-text-secondary leading-relaxed">{section.content}</div>
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

      {/* Sources */}
      {report.sources && report.sources.length > 0 && <SourcesList sources={report.sources} />}
    </div>
  );
}

/** Empty sidebar list state */
function EmptyListState() {
  return <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No research reports yet." description='Click "New" to start your first research.' />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta: Meta = {
  title: "Research/ResearchView",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const ReportList: StoryObj = {
  render: () => {
    const [selected, setSelected] = useState<string | null>("r-001");
    return (
      <div className="h-[700px] bg-surface-secondary/30">
        <ReportListSidebar reports={mockReports} selectedId={selected} onSelect={setSelected} onNew={() => setSelected(null)} />
      </div>
    );
  },
};

export const ReportDetailCompleted: StoryObj = {
  render: () => (
    <div className="bg-surface-secondary/30 min-h-screen">
      <ReportDetailView report={mockReports[0]} />
    </div>
  ),
};

export const ReportDetailRunning: StoryObj = {
  render: () => (
    <div className="bg-surface-secondary/30 min-h-screen">
      <ReportDetailView report={mockReports[1]} />
    </div>
  ),
};

export const ReportDetailFailed: StoryObj = {
  render: () => (
    <div className="bg-surface-secondary/30 min-h-screen">
      <ReportDetailView report={mockReports[2]} />
    </div>
  ),
};

export const SourcesListStory: StoryObj = {
  name: "SourcesList",
  render: () => (
    <div className="max-w-2xl mx-auto p-6 bg-surface-secondary/30 min-h-screen">
      <SourcesList sources={mockSources} />
    </div>
  ),
};

export const EmptyList: StoryObj = {
  render: () => (
    <div className="w-80 h-[500px] border-r border-border bg-surface flex flex-col">
      <div className="h-[3px] bg-gradient-to-r from-primary via-primary/70 to-primary/40 shrink-0" />
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-primary" />
            </div>
            Deep Research
          </h2>
          <Button variant="primary" size="sm">
            New
          </Button>
        </div>
      </div>
      <div className="flex-1">
        <EmptyListState />
      </div>
    </div>
  ),
};

export const FullPage: StoryObj = {
  render: () => {
    const [selected, setSelected] = useState<string | null>("r-001");
    const selectedReport = mockReports.find((r) => r.id === selected);

    return (
      <div className="flex h-screen">
        <ReportListSidebar reports={mockReports} selectedId={selected} onSelect={setSelected} onNew={() => setSelected(null)} />
        <div className="flex-1 overflow-y-auto bg-surface-secondary/30">
          {selectedReport ? (
            <ReportDetailView report={selectedReport} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="w-full max-w-lg p-5">
                <NewResearchForm onSubmit={() => {}} isPending={false} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
};

export const NewResearch: StoryObj = {
  name: "New Research Form",
  render: () => (
    <div className="bg-surface-secondary/30 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-lg p-5">
        <NewResearchForm onSubmit={() => {}} isPending={false} />
      </div>
    </div>
  ),
};

export const ReportDetailQueued: StoryObj = {
  render: () => (
    <div className="bg-surface-secondary/30 min-h-screen">
      <ReportDetailView report={mockReports[5]} />
    </div>
  ),
};

export const ReportDetailCancelled: StoryObj = {
  render: () => (
    <div className="bg-surface-secondary/30 min-h-screen">
      <ReportDetailView report={mockReports[6]} />
    </div>
  ),
};

export const NewResearchWithSidebar: StoryObj = {
  name: "New Research (with Sidebar)",
  render: () => {
    const [selected, setSelected] = useState<string | null>(null);
    const selectedReport = mockReports.find((r) => r.id === selected);

    return (
      <div className="flex h-screen">
        <ReportListSidebar reports={mockReports} selectedId={selected} onSelect={setSelected} onNew={() => setSelected(null)} />
        <div className="flex-1 overflow-y-auto bg-surface-secondary/30">
          {selectedReport ? (
            <ReportDetailView report={selectedReport} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="w-full max-w-lg p-5">
                <NewResearchForm onSubmit={() => {}} isPending={false} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
};
