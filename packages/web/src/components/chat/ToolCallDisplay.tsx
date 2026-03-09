import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Wrench, Check, X, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../ui/Button";

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  status: "pending" | "running" | "success" | "failed" | "approval_required";
}

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

export function ToolCallDisplay({ toolCalls, onApprove, onReject }: ToolCallDisplayProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="space-y-2 my-2">
      {toolCalls.map((call) => (
        <ToolCallItem key={call.id} call={call} onApprove={onApprove} onReject={onReject} />
      ))}
    </div>
  );
}

function ToolCallItem({ call, onApprove, onReject }: {
  call: ToolCall;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: <Loader2 className="h-3.5 w-3.5 text-text-tertiary animate-spin" aria-hidden="true" />,
    running: <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" aria-hidden="true" />,
    success: <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />,
    failed: <X className="h-3.5 w-3.5 text-danger" aria-hidden="true" />,
    approval_required: <Wrench className="h-3.5 w-3.5 text-warning" aria-hidden="true" />,
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-surface-secondary">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-surface-tertiary/50 transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />}
        {statusIcon[call.status]}
        <span className="text-xs font-mono text-text">{call.name}</span>
        <span className={clsx(
          "ml-auto text-[10px] px-1.5 py-0.5 rounded",
          call.status === "success" && "bg-success/10 text-success",
          call.status === "failed" && "bg-danger/10 text-danger",
          call.status === "running" && "bg-primary/10 text-primary",
          call.status === "approval_required" && "bg-warning/10 text-warning",
          call.status === "pending" && "bg-surface-tertiary text-text-tertiary",
        )}>
          {t(`tools.status.${call.status}`, call.status)}
        </span>
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-border space-y-2">
          <div>
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">{t("tools.arguments", "Arguments")}</p>
            <pre className="text-xs font-mono bg-surface rounded p-2 overflow-x-auto text-text-secondary">
              {JSON.stringify(call.arguments, null, 2)}
            </pre>
          </div>

          {call.result && (
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">{t("tools.result", "Result")}</p>
              <pre className="text-xs font-mono bg-surface rounded p-2 overflow-x-auto text-text-secondary max-h-40">
                {call.result}
              </pre>
            </div>
          )}

          {call.status === "approval_required" && onApprove && onReject && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="primary" onClick={() => onApprove(call.id)}>
                <Check className="h-3 w-3" aria-hidden="true" /> {t("tools.approve", "Approve")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onReject(call.id)}>
                <X className="h-3 w-3" aria-hidden="true" /> {t("tools.reject", "Reject")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
