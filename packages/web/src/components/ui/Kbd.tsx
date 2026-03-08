import { type ReactNode } from "react";
import { clsx } from "clsx";

interface KbdProps {
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

export function Kbd({ children, size = "md", className }: KbdProps) {
  return (
    <kbd
      className={clsx(
        "inline-flex items-center justify-center font-mono font-medium leading-none",
        "bg-surface-tertiary border border-border border-b-border-strong rounded text-text-secondary",
        "shadow-[0_1px_0_0] shadow-border-strong/30",
        {
          "text-[10px] min-w-[18px] px-1 py-0.5": size === "sm",
          "text-xs min-w-[22px] px-1.5 py-0.5": size === "md",
        },
        className,
      )}
    >
      {children}
    </kbd>
  );
}

interface KbdComboProps {
  keys: string[];
  size?: "sm" | "md";
  className?: string;
}

export function KbdCombo({ keys, size = "md", className }: KbdComboProps) {
  return (
    <span className={clsx("inline-flex items-center gap-1", className)}>
      {keys.map((key, idx) => (
        <span key={idx} className="inline-flex items-center gap-1">
          {idx > 0 && (
            <span className={clsx("text-text-tertiary", size === "sm" ? "text-[10px]" : "text-xs")}>
              +
            </span>
          )}
          <Kbd size={size}>{key}</Kbd>
        </span>
      ))}
    </span>
  );
}
