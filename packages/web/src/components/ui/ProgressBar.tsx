import { clsx } from "clsx";

interface ProgressBarProps {
  value?: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "danger";
  label?: string;
  showValue?: boolean;
  indeterminate?: boolean;
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  value = 0,
  max = 100,
  size = "md",
  variant = "default",
  label,
  showValue = false,
  indeterminate = false,
  animated = false,
  className,
}: ProgressBarProps) {
  const percent = indeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const displayValue = indeterminate ? undefined : `${Math.round(percent)}%`;

  return (
    <div className={clsx("w-full", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-text">{label}</span>}
          {showValue && !indeterminate && (
            <span className="text-xs tabular-nums text-text-tertiary">{displayValue}</span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={clsx(
          "w-full rounded-full overflow-hidden",
          {
            "h-1": size === "sm",
            "h-2": size === "md",
            "h-3": size === "lg",
          },
          "bg-surface-tertiary",
        )}
      >
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-500 ease-out",
            {
              "bg-primary": variant === "default",
              "bg-success": variant === "success",
              "bg-warning": variant === "warning",
              "bg-danger": variant === "danger",
            },
            animated && !indeterminate && "progress-bar-glow",
            indeterminate && "progress-bar-indeterminate",
          )}
          style={
            indeterminate
              ? { width: "40%", animation: "progress-slide 1.4s ease-in-out infinite" }
              : { width: `${percent}%` }
          }
        />
      </div>

      <style>{`
        @keyframes progress-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        .progress-bar-glow {
          box-shadow: 0 0 8px currentColor;
          animation: progress-pulse 2s ease-in-out infinite;
        }
        @keyframes progress-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
