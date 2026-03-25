import { Check, X, Circle } from "lucide-react";
import { clsx } from "clsx";

export function ProgressWidget({ params }: { params?: Record<string, string> }) {
  const steps = String(params?.steps ?? "Step 1,Step 2,Step 3").split(",").map((s) => s.trim());
  const current = Math.max(0, Math.min(steps.length - 1, parseInt(params?.current ?? "0", 10) || 0));
  const rawStatus = String(params?.status ?? "in-progress").toLowerCase();
  const status: "in-progress" | "completed" | "failed" =
    rawStatus.includes("complete") || rawStatus.includes("done") ? "completed"
    : rawStatus.includes("fail") || rawStatus.includes("error") ? "failed"
    : "in-progress";

  return (
    <div className="px-4 py-4">
      <div className="flex items-center">
        {steps.map((step, i) => {
          const isCompleted = i < current || (i === current && status === "completed");
          const isCurrent = i === current && status !== "completed";
          const isFailed = i === current && status === "failed";

          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all",
                    isCompleted && "bg-green-500 border-green-500",
                    isFailed && "bg-red-500 border-red-500",
                    isCurrent && !isFailed && "border-primary animate-pulse",
                    !isCompleted && !isCurrent && "border-border",
                  )}
                >
                  {isCompleted && <Check className="h-3.5 w-3.5 text-white" />}
                  {isFailed && <X className="h-3.5 w-3.5 text-white" />}
                  {isCurrent && !isFailed && (
                    <Circle className="h-2.5 w-2.5 text-primary fill-primary" />
                  )}
                </div>
                <span
                  className={clsx(
                    "text-[10px] mt-1.5 text-center max-w-16 truncate",
                    isCompleted || isCurrent ? "text-text" : "text-text-tertiary",
                  )}
                  title={step}
                >
                  {step}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className={clsx(
                    "flex-1 h-0.5 mx-1 mt-[-1.25rem]",
                    i < current ? "bg-green-500" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
