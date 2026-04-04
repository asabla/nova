import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

interface BranchNavigatorProps {
  siblingIndex: number;
  siblingCount: number;
  onPrev: () => void;
  onNext: () => void;
}

export function BranchNavigator({ siblingIndex, siblingCount, onPrev, onNext }: BranchNavigatorProps) {
  if (siblingCount <= 1) return null;

  return (
    <div className="inline-flex items-center gap-0.5 text-[11px] text-text-tertiary">
      <button
        onClick={onPrev}
        disabled={siblingIndex === 0}
        className={clsx(
          "p-0.5 rounded transition-colors",
          siblingIndex === 0
            ? "opacity-30 cursor-default"
            : "hover:text-text-secondary hover:bg-surface-secondary",
        )}
        aria-label="Previous version"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="tabular-nums min-w-[2.5rem] text-center">
        {siblingIndex + 1}/{siblingCount}
      </span>
      <button
        onClick={onNext}
        disabled={siblingIndex === siblingCount - 1}
        className={clsx(
          "p-0.5 rounded transition-colors",
          siblingIndex === siblingCount - 1
            ? "opacity-30 cursor-default"
            : "hover:text-text-secondary hover:bg-surface-secondary",
        )}
        aria-label="Next version"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
