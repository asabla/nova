import { Loader2, Check, AlertCircle, GitBranch, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export interface PlanStepData {
  step: number;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface SubtaskData {
  subtaskId: string;
  description: string;
  step: number;
  summary?: string;
  status: "spawned" | "running" | "completed" | "failed";
}

interface SubtaskProgressProps {
  plan?: { steps: PlanStepData[]; reasoning?: string };
  subtasks: SubtaskData[];
}

const STATUS_ICON = {
  pending: null,
  spawned: <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />,
  completed: <Check className="h-3.5 w-3.5 text-success" />,
  failed: <AlertCircle className="h-3.5 w-3.5 text-danger" />,
};

export function SubtaskProgress({ plan, subtasks }: SubtaskProgressProps) {
  const [expanded, setExpanded] = useState(true);

  if (!plan && subtasks.length === 0) return null;

  const completedCount = (plan?.steps ?? []).filter((s) => s.status === "completed").length;
  const totalSteps = plan?.steps?.length ?? 0;

  return (
    <div className="mx-4 my-2 rounded-lg border border-border bg-card text-card-foreground">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-t-lg"
      >
        <GitBranch className="h-4 w-4 text-primary" />
        <span>Agent Plan</span>
        {totalSteps > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalSteps} steps
          </span>
        )}
        <span className="ml-auto">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {plan?.reasoning && (
            <p className="text-xs text-muted-foreground italic mb-2">{plan.reasoning}</p>
          )}

          {plan?.steps.map((step) => {
            const subtask = subtasks.find((s) => s.step === step.step);
            const effectiveStatus = subtask?.status ?? step.status;

            return (
              <div key={step.step} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0">
                  {STATUS_ICON[effectiveStatus] ?? (
                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-border" />
                  )}
                </span>
                <div className="min-w-0">
                  <span className={effectiveStatus === "completed" ? "text-muted-foreground line-through" : ""}>
                    {step.description}
                  </span>
                  {subtask?.summary && (
                    <p className="text-xs text-muted-foreground mt-0.5">{subtask.summary}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
