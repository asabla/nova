import { useState } from "react";
import { ChevronDown, ChevronRight, Brain, Clock } from "lucide-react";
import { clsx } from "clsx";

interface Step {
  id: string;
  type: "thought" | "tool_call" | "tool_result" | "sub_agent";
  content: string;
  name?: string;
  duration?: number;
  timestamp: string;
}

interface AgentReasoningTraceProps {
  steps: Step[];
}

export function AgentReasoningTrace({ steps }: AgentReasoningTraceProps) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Brain className="h-3.5 w-3.5" />
        <span>{steps.length} reasoning steps</span>
      </button>

      {expanded && (
        <div className="mt-2 ml-2 border-l-2 border-border pl-4 space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className={clsx(
                  "px-1.5 py-0.5 rounded text-[10px] font-mono",
                  step.type === "thought" && "bg-primary/10 text-primary",
                  step.type === "tool_call" && "bg-warning/10 text-warning",
                  step.type === "tool_result" && "bg-success/10 text-success",
                  step.type === "sub_agent" && "bg-primary/10 text-primary-dark",
                )}>
                  {step.type}
                </span>
                {step.name && <span className="font-mono text-text-secondary">{step.name}</span>}
                {step.duration && (
                  <span className="text-text-tertiary flex items-center gap-0.5 ml-auto">
                    <Clock className="h-3 w-3" />
                    {step.duration}ms
                  </span>
                )}
              </div>
              <p className="text-text-secondary whitespace-pre-wrap">{step.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
