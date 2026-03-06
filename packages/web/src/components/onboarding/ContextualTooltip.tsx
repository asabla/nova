import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";

const TOOLTIP_STORAGE_KEY = "nova:dismissed-tooltips";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface ContextualTooltipProps {
  /** Unique identifier for this tooltip (used for localStorage tracking) */
  id: string;
  /** Content displayed inside the tooltip */
  content: ReactNode;
  /** Brief title for the tooltip */
  title?: string;
  /** Position relative to the target element */
  position?: TooltipPosition;
  /** The target element(s) to wrap */
  children: ReactNode;
  /** Show only once on first interaction, then auto-dismiss */
  dismissOnInteract?: boolean;
  /** Delay in ms before showing the tooltip */
  showDelay?: number;
  /** If true, the tooltip is forcibly hidden regardless of state */
  disabled?: boolean;
}

function getDismissedTooltips(): Set<string> {
  try {
    const stored = localStorage.getItem(TOOLTIP_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function dismissTooltip(id: string) {
  try {
    const dismissed = getDismissedTooltips();
    dismissed.add(id);
    localStorage.setItem(TOOLTIP_STORAGE_KEY, JSON.stringify([...dismissed]));
  } catch {
    // localStorage unavailable
  }
}

/** Reset all dismissed tooltips (useful for re-triggering onboarding) */
export function resetAllTooltips() {
  try {
    localStorage.removeItem(TOOLTIP_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

/** Check if a specific tooltip has been dismissed */
export function isTooltipDismissed(id: string): boolean {
  return getDismissedTooltips().has(id);
}

const positionClasses: Record<
  TooltipPosition,
  { container: string; arrow: string }
> = {
  top: {
    container:
      "bottom-full left-1/2 -translate-x-1/2 mb-3",
    arrow:
      "absolute top-full left-1/2 -translate-x-1/2 -mt-px border-[6px] border-transparent border-t-surface-secondary",
  },
  bottom: {
    container:
      "top-full left-1/2 -translate-x-1/2 mt-3",
    arrow:
      "absolute bottom-full left-1/2 -translate-x-1/2 -mb-px border-[6px] border-transparent border-b-surface-secondary",
  },
  left: {
    container:
      "right-full top-1/2 -translate-y-1/2 mr-3",
    arrow:
      "absolute left-full top-1/2 -translate-y-1/2 -ml-px border-[6px] border-transparent border-l-surface-secondary",
  },
  right: {
    container:
      "left-full top-1/2 -translate-y-1/2 ml-3",
    arrow:
      "absolute right-full top-1/2 -translate-y-1/2 -mr-px border-[6px] border-transparent border-r-surface-secondary",
  },
};

export function ContextualTooltip({
  id,
  content,
  title,
  position = "bottom",
  children,
  dismissOnInteract = true,
  showDelay = 500,
  disabled = false,
}: ContextualTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if tooltip was already dismissed
  useEffect(() => {
    if (disabled) {
      setDismissed(true);
      return;
    }
    const alreadyDismissed = getDismissedTooltips().has(id);
    setDismissed(alreadyDismissed);

    if (!alreadyDismissed) {
      timerRef.current = setTimeout(() => {
        setVisible(true);
      }, showDelay);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, showDelay, disabled]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    dismissTooltip(id);
  }, [id]);

  const handleInteract = useCallback(() => {
    if (dismissOnInteract && visible) {
      handleDismiss();
    }
  }, [dismissOnInteract, visible, handleDismiss]);

  if (dismissed) {
    return <>{children}</>;
  }

  const pos = positionClasses[position];

  return (
    <div className="relative inline-block" onClick={handleInteract}>
      {children}

      {visible && (
        <div
          className={`absolute z-50 ${pos.container}`}
          role="tooltip"
        >
          <div className="relative w-64 p-3 rounded-xl bg-surface-secondary border border-border shadow-lg">
            {/* Arrow */}
            <div className={pos.arrow} />

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="absolute top-2 right-2 p-0.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors"
              aria-label="Dismiss tip"
            >
              <X className="h-3 w-3" />
            </button>

            {/* Content */}
            {title && (
              <p className="text-xs font-semibold text-text mb-1 pr-4">
                {title}
              </p>
            )}
            <div className="text-[11px] text-text-secondary leading-relaxed pr-4">
              {content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
