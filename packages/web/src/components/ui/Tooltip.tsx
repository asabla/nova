import { useState, useRef, useCallback, useId, type ReactNode } from "react";
import { clsx } from "clsx";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayMs?: number;
  className?: string;
}

export function Tooltip({ content, children, side = "top", delayMs = 300, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delayMs);
  }, [delayMs]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-[color:var(--color-text)] border-t-4 border-x-4 border-x-transparent border-b-0",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[color:var(--color-text)] border-b-4 border-x-4 border-x-transparent border-t-0",
    left: "left-full top-1/2 -translate-y-1/2 border-l-[color:var(--color-text)] border-l-4 border-y-4 border-y-transparent border-r-0",
    right: "right-full top-1/2 -translate-y-1/2 border-r-[color:var(--color-text)] border-r-4 border-y-4 border-y-transparent border-l-0",
  };

  return (
    <div
      className={clsx("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <div aria-describedby={visible ? tooltipId : undefined}>{children}</div>

      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={clsx(
            "absolute z-50 pointer-events-none",
            "px-2.5 py-1.5 rounded-lg",
            "bg-text text-surface text-xs font-medium",
            "whitespace-nowrap",
            "animate-in fade-in duration-150",
            positionClasses[side],
          )}
        >
          {content}
          <span className={clsx("absolute w-0 h-0", arrowClasses[side])} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
