import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Wrench,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Clock,
  AlertTriangle,
  RotateCcw,
  Play,
  Pause,
  Eye,
  Code2,
} from "lucide-react";
import { clsx } from "clsx";

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string | null;
  status: "pending" | "approved" | "rejected" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  error?: string | null;
  durationMs?: number | null;
}

interface ToolCallPanelProps {
  toolCalls: ToolCall[];
  approvalMode: "auto" | "always-ask" | "never";
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
  onRetry?: (toolCallId: string) => void;
  isExpanded?: boolean;
}

const statusConfig = {
  pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10", label: "Pending approval" },
  approved: { icon: Check, color: "text-success", bg: "bg-success/10", label: "Approved" },
  rejected: { icon: X, color: "text-danger", bg: "bg-danger/10", label: "Rejected" },
  running: { icon: Play, color: "text-primary", bg: "bg-primary/10", label: "Running" },
  completed: { icon: Check, color: "text-success", bg: "bg-success/10", label: "Completed" },
  failed: { icon: AlertTriangle, color: "text-danger", bg: "bg-danger/10", label: "Failed" },
};

export function ToolCallPanel({
  toolCalls,
  approvalMode,
  onApprove,
  onReject,
  onRetry,
  isExpanded: defaultExpanded = false,
}: ToolCallPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  if (toolCalls.length === 0) return null;

  const completedCount = toolCalls.filter((tc) => tc.status === "completed").length;
  const failedCount = toolCalls.filter((tc) => tc.status === "failed").length;
  const pendingCount = toolCalls.filter((tc) => tc.status === "pending").length;

  const toggleCall = (id: string) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface-secondary overflow-hidden my-2">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-tertiary transition-colors"
      >
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Wrench className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-text">
            Tool Calls ({toolCalls.length})
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            {completedCount > 0 && (
              <span className="text-[10px] text-success">{completedCount} completed</span>
            )}
            {failedCount > 0 && (
              <span className="text-[10px] text-danger">{failedCount} failed</span>
            )}
            {pendingCount > 0 && (
              <span className="text-[10px] text-warning">{pendingCount} pending</span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-text-tertiary shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {toolCalls.map((tc) => {
            const config = statusConfig[tc.status];
            const StatusIcon = config.icon;
            const isCallExpanded = expandedCalls.has(tc.id);

            return (
              <div key={tc.id} className="px-4 py-3">
                {/* Tool call header */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCall(tc.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {isCallExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                    )}
                    <Code2 className="h-3.5 w-3.5 text-text-secondary shrink-0" />
                    <span className="text-xs font-mono font-medium text-text truncate">
                      {tc.name}
                    </span>
                  </button>

                  <div className={clsx("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", config.bg, config.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </div>

                  {tc.durationMs != null && (
                    <span className="text-[10px] text-text-tertiary">
                      {tc.durationMs}ms
                    </span>
                  )}
                </div>

                {/* Expanded details */}
                {isCallExpanded && (
                  <div className="mt-3 space-y-2 pl-6">
                    {/* Arguments */}
                    <div>
                      <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                        Arguments
                      </p>
                      <pre className="text-xs text-text-secondary bg-surface rounded-lg p-3 overflow-x-auto font-mono">
                        {JSON.stringify(tc.arguments, null, 2)}
                      </pre>
                    </div>

                    {/* Result */}
                    {tc.result && (
                      <div>
                        <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Result
                        </p>
                        <pre className="text-xs text-text-secondary bg-surface rounded-lg p-3 overflow-x-auto font-mono max-h-48 overflow-y-auto">
                          {tc.result}
                        </pre>
                      </div>
                    )}

                    {/* Error */}
                    {tc.error && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-danger/5 border border-danger/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-danger mt-0.5 shrink-0" />
                        <p className="text-xs text-danger">{tc.error}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {tc.status === "pending" && approvalMode === "always-ask" && (
                        <>
                          {onApprove && (
                            <button
                              onClick={() => onApprove(tc.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
                            >
                              <Check className="h-3 w-3" /> Approve
                            </button>
                          )}
                          {onReject && (
                            <button
                              onClick={() => onReject(tc.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger/10 text-danger text-xs font-medium hover:bg-danger/20 transition-colors"
                            >
                              <X className="h-3 w-3" /> Reject
                            </button>
                          )}
                        </>
                      )}
                      {tc.status === "failed" && onRetry && (
                        <button
                          onClick={() => onRetry(tc.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" /> Retry
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
