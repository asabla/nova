import { clsx } from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
  "aria-label"?: string;
}

export function Badge({ children, variant = "default", className, "aria-label": ariaLabel }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-surface-tertiary text-text-secondary": variant === "default",
          "bg-primary/10 text-primary": variant === "primary",
          "bg-success/10 text-success": variant === "success",
          "bg-warning/10 text-warning": variant === "warning",
          "bg-danger/10 text-danger": variant === "danger",
        },
        className,
      )}
      aria-label={ariaLabel}
    >
      {children}
    </span>
  );
}
