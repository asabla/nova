import { ChevronDown, ChevronRight, AlertTriangle, Activity, Wrench, Clock } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../ui/Table";
import type { AgentRun } from "./types";
import { formatNumber, formatCost, formatLatency, formatDateTime } from "./types";
import { LoadingSkeleton, EmptyState } from "./SummaryCards";

export function AgentTracesTab({
  traces,
  loading,
  expandedTraceId,
  onToggleTrace,
}: {
  traces: AgentRun[];
  loading: boolean;
  expandedTraceId: string | null;
  onToggleTrace: (id: string) => void;
}) {
  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text">Agent Run Traces</h3>
          <Badge variant="warning">Sample data</Badge>
        </div>
        <p className="text-xs text-text-tertiary">Recent agent executions with tool call details</p>
      </div>

      {loading ? <LoadingSkeleton height="h-64" /> : traces.length === 0 ? <EmptyState message="No agent traces found for this period" /> : (
        <div className="overflow-x-auto -mx-5 px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Agent</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-center">Status</TableHead>
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
                  onToggle={() => onToggleTrace(trace.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TraceRow({ trace, isExpanded, onToggle }: { trace: AgentRun; isExpanded: boolean; onToggle: () => void }) {
  const statusColors: Record<string, "success" | "danger" | "warning" | "primary"> = {
    success: "success", error: "danger", timeout: "warning", running: "primary",
  };

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
        <TableCell className="text-text-secondary text-xs">{trace.userName}</TableCell>
        <TableCell className="text-text-secondary text-xs">{trace.modelName}</TableCell>
        <TableCell className="text-center">
          <Badge variant={statusColors[trace.status] ?? "default"}>{trace.status}</Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatLatency(trace.durationMs)}</TableCell>
        <TableCell className="text-right tabular-nums">{formatNumber(trace.totalTokens)}</TableCell>
        <TableCell className="text-right tabular-nums">{formatCost(trace.costCents)}</TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8} className="p-0">
            <div className="bg-surface border-y border-border/50 px-8 py-4 space-y-3">
              {trace.errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                  <p className="text-xs text-danger">{trace.errorMessage}</p>
                </div>
              )}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary mb-2">Tool Calls ({trace.toolCalls.length})</h4>
                <div className="space-y-2">
                  {trace.toolCalls.map((tc, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-surface-secondary rounded-lg border border-border">
                      <Wrench className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-text">{tc.name}</span>
                          <Badge variant={tc.status === "success" ? "success" : "danger"}>{tc.status}</Badge>
                        </div>
                        {tc.input && <p className="text-[10px] text-text-tertiary mt-1 font-mono truncate">Input: {tc.input}</p>}
                        {tc.output && <p className="text-[10px] text-text-tertiary mt-0.5 font-mono truncate">Output: {tc.output}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3 text-text-tertiary" />
                        <span className="text-xs text-text-secondary tabular-nums">{formatLatency(tc.durationMs)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-tertiary pt-1">
                <span>Conversation: <span className="font-mono text-text-secondary">{trace.conversationId}</span></span>
                <span>Trace ID: <span className="font-mono text-text-secondary">{trace.id}</span></span>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
