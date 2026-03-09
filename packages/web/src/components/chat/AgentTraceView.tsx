import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  GitBranch,
  Layers,
  MessageSquare,
  Wrench,
  AlertTriangle,
  Check,
  X,
  RotateCcw,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";

interface TraceStep {
  id: string;
  type: "thinking" | "tool_call" | "tool_result" | "sub_agent" | "user_input" | "output";
  label: string;
  content?: string;
  status: "pending" | "running" | "completed" | "failed" | "waiting_input";
  durationMs?: number;
  tokenCount?: number;
  error?: string;
  children?: TraceStep[];
  toolName?: string;
  subAgentId?: string;
  subAgentName?: string;
}

interface AgentTraceViewProps {
  steps: TraceStep[];
  agentName?: string;
  totalDurationMs?: number;
  totalTokens?: number;
  maxSteps?: number;
  isRunning?: boolean;
  onStop?: () => void;
  onRetryStep?: (stepId: string) => void;
  onRespondToInput?: (stepId: string, response: string) => void;
}

const stepTypeConfig = {
  thinking: { icon: Brain, color: "text-purple-400", label: "Thinking" },
  tool_call: { icon: Wrench, color: "text-primary", label: "Tool Call" },
  tool_result: { icon: Check, color: "text-success", label: "Tool Result" },
  sub_agent: { icon: GitBranch, color: "text-warning", label: "Sub-Agent" },
  user_input: { icon: MessageSquare, color: "text-primary", label: "User Input" },
  output: { icon: Zap, color: "text-success", label: "Output" },
};

const statusColors = {
  pending: "border-border",
  running: "border-primary animate-pulse",
  completed: "border-success/50",
  failed: "border-danger/50",
  waiting_input: "border-warning animate-pulse",
};

function TraceStepItem({
  step,
  depth = 0,
  onRetry,
  onRespond,
}: {
  step: TraceStep;
  depth?: number;
  onRetry?: (stepId: string) => void;
  onRespond?: (stepId: string, response: string) => void;
}) {
  const [expanded, setExpanded] = useState(
    step.status === "running" || step.status === "waiting_input" || step.status === "failed"
  );
  const [inputResponse, setInputResponse] = useState("");

  const config = stepTypeConfig[step.type];
  const StepIcon = config.icon;
  const hasContent = !!(step.content || step.error || step.children?.length);

  return (
    <div className={clsx("relative", depth > 0 && "ml-6")}>
      {/* Connecting line */}
      {depth > 0 && (
        <div className="absolute -left-3 top-0 bottom-0 w-px bg-border" />
      )}

      <div className={clsx("border-l-2 pl-4 py-2", statusColors[step.status])}>
        {/* Step header */}
        <button
          onClick={() => hasContent && setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left group"
          disabled={!hasContent}
        >
          <StepIcon className={clsx("h-3.5 w-3.5 shrink-0", config.color)} />
          <span className="text-xs font-medium text-text flex-1 min-w-0 truncate">
            {step.label}
          </span>

          {step.status === "running" && (
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <Cpu className="h-3 w-3 animate-spin" /> Running
            </span>
          )}
          {step.status === "waiting_input" && (
            <span className="flex items-center gap-1 text-[10px] text-warning">
              <Clock className="h-3 w-3" /> Waiting for input
            </span>
          )}
          {step.status === "failed" && (
            <span className="flex items-center gap-1 text-[10px] text-danger">
              <AlertTriangle className="h-3 w-3" /> Failed
            </span>
          )}

          {step.durationMs != null && step.status === "completed" && (
            <span className="text-[10px] text-text-tertiary">{step.durationMs}ms</span>
          )}
          {step.tokenCount != null && (
            <span className="text-[10px] text-text-tertiary">{step.tokenCount} tokens</span>
          )}

          {hasContent && (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            )
          )}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-2 space-y-2">
            {step.content && (
              <pre className="text-xs text-text-secondary bg-surface rounded-lg p-3 overflow-x-auto font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                {step.content}
              </pre>
            )}

            {step.error && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-danger/5 border border-danger/20">
                <AlertTriangle className="h-3.5 w-3.5 text-danger mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-danger">{step.error}</p>
                  {onRetry && (
                    <button
                      onClick={() => onRetry(step.id)}
                      className="mt-2 flex items-center gap-1 px-3 py-1 rounded-lg bg-danger/10 text-danger text-xs font-medium hover:bg-danger/20 transition-colors"
                    >
                      <RotateCcw className="h-3 w-3" /> Retry this step
                    </button>
                  )}
                </div>
              </div>
            )}

            {step.status === "waiting_input" && onRespond && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputResponse}
                  onChange={(e) => setInputResponse(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && inputResponse.trim()) {
                      onRespond(step.id, inputResponse.trim());
                      setInputResponse("");
                    }
                  }}
                  placeholder="Type your response..."
                  className="flex-1 h-8 px-3 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary field-glow"
                />
                <button
                  onClick={() => {
                    if (inputResponse.trim()) {
                      onRespond(step.id, inputResponse.trim());
                      setInputResponse("");
                    }
                  }}
                  className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors"
                >
                  Send
                </button>
              </div>
            )}

            {step.subAgentName && (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <GitBranch className="h-3 w-3" />
                Sub-agent: <span className="font-medium text-text">{step.subAgentName}</span>
              </div>
            )}

            {/* Nested steps */}
            {step.children?.map((child) => (
              <TraceStepItem
                key={child.id}
                step={child}
                depth={depth + 1}
                onRetry={onRetry}
                onRespond={onRespond}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentTraceView({
  steps,
  agentName,
  totalDurationMs,
  totalTokens,
  maxSteps,
  isRunning,
  onStop,
  onRetryStep,
  onRespondToInput,
}: AgentTraceViewProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface-secondary overflow-hidden my-2">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
            <Brain className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-text">
              {agentName ? `${agentName} Trace` : "Agent Trace"}
            </span>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] text-text-tertiary">
                {steps.length} step{steps.length !== 1 ? "s" : ""}
                {maxSteps ? ` / ${maxSteps} max` : ""}
              </span>
              {totalDurationMs != null && (
                <span className="text-[10px] text-text-tertiary">
                  {(totalDurationMs / 1000).toFixed(1)}s
                </span>
              )}
              {totalTokens != null && (
                <span className="text-[10px] text-text-tertiary">
                  {totalTokens.toLocaleString()} tokens
                </span>
              )}
            </div>
          </div>
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary shrink-0" />
          )}
        </button>

        {isRunning && onStop && (
          <button
            onClick={onStop}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger/10 text-danger text-xs font-medium hover:bg-danger/20 transition-colors"
          >
            <X className="h-3 w-3" /> Stop
          </button>
        )}
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="px-4 py-3 space-y-1">
          {steps.map((step) => (
            <TraceStepItem
              key={step.id}
              step={step}
              onRetry={onRetryStep}
              onRespond={onRespondToInput}
            />
          ))}

          {isRunning && (
            <div className="flex items-center gap-2 py-2 pl-4">
              <div className="flex gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[10px] text-text-tertiary">Agent is working...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
