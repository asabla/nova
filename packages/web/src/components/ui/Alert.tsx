import { forwardRef, type ReactNode } from "react";
import { clsx } from "clsx";
import { Info, CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";

/* ── Alert ── */

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "danger";
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: ReactNode;
}

const variantConfig = {
  info: {
    border: "border-l-primary",
    bg: "bg-primary/5",
    iconColor: "text-primary",
    Icon: Info,
    role: "status" as const,
  },
  success: {
    border: "border-l-success",
    bg: "bg-success/5",
    iconColor: "text-success",
    Icon: CheckCircle,
    role: "status" as const,
  },
  warning: {
    border: "border-l-warning",
    bg: "bg-warning/5",
    iconColor: "text-warning",
    Icon: AlertTriangle,
    role: "alert" as const,
  },
  danger: {
    border: "border-l-danger",
    bg: "bg-danger/5",
    iconColor: "text-danger",
    Icon: XCircle,
    role: "alert" as const,
  },
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", dismissible = false, onDismiss, icon, children, ...props }, ref) => {
    const config = variantConfig[variant];
    const DefaultIcon = config.Icon;

    return (
      <div
        ref={ref}
        role={config.role}
        className={clsx(
          "relative flex gap-3 rounded-lg border border-border border-l-4 px-4 py-3",
          config.border,
          config.bg,
          className,
        )}
        {...props}
      >
        <div className={clsx("shrink-0 mt-0.5", config.iconColor)} aria-hidden="true">
          {icon ?? <DefaultIcon className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">{children}</div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 -mt-0.5 -mr-1 p-1 rounded-md text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  },
);
Alert.displayName = "Alert";

/* ── AlertTitle ── */

export const AlertTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={clsx("text-sm font-semibold text-text", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

/* ── AlertDescription ── */

export const AlertDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={clsx("text-xs text-text-secondary mt-0.5", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

/* ── AlertActions ── */

export const AlertActions = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={clsx("flex items-center gap-2 mt-3", className)} {...props} />
  ),
);
AlertActions.displayName = "AlertActions";
