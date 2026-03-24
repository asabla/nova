import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Activity, Wrench, Clock, Search, Coins, Hash } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../ui/Table";
import { TierBadge } from "../../chat/TierBadge";
import { PlanDAGView } from "../../chat/PlanDAGView";
import type { AgentRun, ToolCall } from "./types";
import { formatNumber, formatCost, formatLatency, formatDateTime } from "./types";

export function AgentTracesTab({
  traces,
  loading,
  hasMore,
  onLoadMore,
  loadingMore,
  filters,
  onFiltersChange,
}: {
  traces: AgentRun[];
  loading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  filters: TraceFilters;
  onFiltersChange: (filters: TraceFilters) => void;
}) {
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text">Agent Run Traces</h3>
        </div>
        <p className="text-xs text-text-tertiary">Recent agent executions with tool call details</p>
      </div>

      <TraceFilterBar filters={filters} onChange={onFiltersChange} />

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse text-text-tertiary text-sm">Loading traces...</div>
        </div>
      ) : traces.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-text-tertiary text-sm">
          No agent traces found for this period
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Agent</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Steps</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {traces.map((trace) => (
                  <TraceRow
                    key={trace.id}
                    trace={trace}
                    isExpanded={expandedTraceId === trace.id}
                    onToggle={() => setExpandedTraceId(expandedTraceId === trace.id ? null : trace.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && onLoadMore && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────

export interface TraceFilters {
  status?: string;
  tier?: string;
  search?: string;
}

function TraceFilterBar({ filters, onChange }: { filters: TraceFilters; onChange: (f: TraceFilters) => void }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <select
        value={filters.status ?? ""}
        onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
        className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-text"
      >
        <option value="">All statuses</option>
        <option value="success">Success</option>
        <option value="error">Error</option>
        <option value="timeout">Timeout</option>
        <option value="running">Running</option>
      </select>

      <select
        value={filters.tier ?? ""}
        onChange={(e) => onChange({ ...filters, tier: e.target.value || undefined })}
        className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-text"
      >
        <option value="">All tiers</option>
        <option value="direct">Direct</option>
        <option value="sequential">Sequential</option>
        <option value="orchestrated">Orchestrated</option>
      </select>

      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search agent, user, error..."
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
          className="w-full text-xs bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-text placeholder:text-text-tertiary"
        />
      </div>
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<string, "success" | "danger" | "warning" | "primary"> = {
  success: "success",
  error: "danger",
  timeout: "warning",
  running: "primary",
};

function TraceRow({ trace, isExpanded, onToggle }: { trace: AgentRun; isExpanded: boolean; onToggle: () => void }) {
  const modelShort = useMemo(() => {
    const m = trace.modelName;
    // Shorten "claude-sonnet-4-20250514" → "claude-sonnet-4"
    return m.replace(/-\d{8}$/, "");
  }, [trace.modelName]);

  return (
    <>
      <TableRow onClick={onToggle} className="hover:bg-surface-tertiary/30 cursor-pointer">
        <TableCell className="pr-2">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-text-tertiary" /> : <ChevronRight className="h-4 w-4 text-text-tertiary" />}
        </TableCell>
        <TableCell className="font-medium">
          {trace.agentName}
          <p className="text-[10px] text-text-tertiary">{formatDateTime(trace.startedAt)}</p>
        </TableCell>
        <TableCell>
          {trace.tier ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium capitalize text-text-secondary">
              {trace.tier}
            </span>
          ) : (
            <span className="text-text-tertiary text-[10px]">—</span>
          )}
        </TableCell>
        <TableCell className="text-text-secondary text-xs">{trace.userName}</TableCell>
        <TableCell className="text-text-secondary text-xs">{modelShort}</TableCell>
        <TableCell className="text-center">
          <Badge variant={STATUS_VARIANTS[trace.status] ?? "default"}>{trace.status}</Badge>
        </TableCell>
        <TableCell className="text-right text-xs tabular-nums text-text-secondary">
          {trace.steps > 0 ? trace.steps : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatLatency(trace.durationMs)}</TableCell>
        <TableCell className="text-right text-xs tabular-nums text-text-secondary">
          {trace.inputTokens > 0 || trace.outputTokens > 0
            ? `${formatNumber(trace.inputTokens)} / ${formatNumber(trace.outputTokens)}`
            : formatNumber(trace.totalTokens)}
        </TableCell>
        <TableCell className="text-right tabular-nums">{trace.costCents > 0 ? formatCost(trace.costCents) : "—"}</TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={10} className="p-0">
            <TraceDetail trace={trace} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Expanded trace detail ─────────────────────────────────────────────

function TraceDetail({ trace }: { trace: AgentRun }) {
  return (
    <div className="bg-surface border-y border-border/50 px-6 py-4 space-y-4">
      {/* Section 1: Execution Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        {trace.tier && <TierBadge tier={trace.tier} reasoning={trace.tierReasoning} />}
        {trace.terminalReason && trace.terminalReason !== "completed" && (
          <Badge variant="warning">{trace.terminalReason.replace(/_/g, " ")}</Badge>
        )}
        {trace.durationMs > 0 && (
          <span className="text-xs text-text-tertiary flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatLatency(trace.durationMs)}
          </span>
        )}
      </div>

      {/* Error */}
      {trace.errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
          <p className="text-xs text-danger">{trace.errorMessage}</p>
        </div>
      )}

      {/* Section 2: Plan DAG (sequential/orchestrated only) */}
      {trace.plan?.nodes && trace.plan.nodes.length > 0 && (
        <div className="-mx-2">
          <PlanDAGView plan={trace.plan} isRunning={false} defaultCollapsed={false} />
        </div>
      )}

      {/* Section 3: Tool Calls (always show for direct tier, or when no plan) */}
      {(!trace.plan || trace.tier === "direct") && trace.toolCalls.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Tool Calls ({trace.toolCalls.length})
          </h4>
          <div className="space-y-1.5">
            {trace.toolCalls.map((tc, i) => (
              <ToolCallRow key={i} tc={tc} />
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Token/Cost Summary */}
      <div className="flex items-center gap-6 text-xs text-text-tertiary pt-1 border-t border-border/30">
        <span className="flex items-center gap-1">
          <Hash className="h-3 w-3" />
          Tokens: <span className="text-text-secondary tabular-nums">
            {formatNumber(trace.inputTokens)} in / {formatNumber(trace.outputTokens)} out
          </span>
        </span>
        {trace.costCents > 0 && (
          <span className="flex items-center gap-1">
            <Coins className="h-3 w-3" />
            Cost: <span className="text-text-secondary tabular-nums">{formatCost(trace.costCents)}</span>
          </span>
        )}
      </div>

      {/* Section 5: Metadata */}
      <div className="flex items-center gap-4 text-xs text-text-tertiary">
        <span>Conversation: <span className="font-mono text-text-secondary">{trace.conversationId}</span></span>
        <span>Workflow: <span className="font-mono text-text-secondary">{trace.id}</span></span>
      </div>
    </div>
  );
}

// ── Tool Call Row ─────────────────────────────────────────────────────

function ToolCallRow({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-2.5 bg-surface-secondary rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full text-left"
      >
        <Wrench className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-medium text-text">{tc.name}</span>
          <Badge variant={tc.status === "success" ? "success" : "danger"}>{tc.status}</Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3 text-text-tertiary" />
          <span className="text-xs text-text-secondary tabular-nums">{formatLatency(tc.durationMs)}</span>
        </div>
        {(tc.input || tc.output) && (
          expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="mt-2 ml-7 space-y-1">
          {tc.input && (
            <pre className="text-[10px] text-text-tertiary font-mono bg-surface rounded p-2 overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap">
              <span className="text-text-secondary font-semibold">Input: </span>{tc.input}
            </pre>
          )}
          {tc.output && (
            <pre className="text-[10px] text-text-tertiary font-mono bg-surface rounded p-2 overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap">
              <span className="text-text-secondary font-semibold">Output: </span>{tc.output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
