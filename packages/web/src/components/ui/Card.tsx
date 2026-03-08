import { forwardRef } from "react";
import { clsx } from "clsx";

/* ── Card ── */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "elevated";
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hover = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "rounded-xl overflow-hidden",
          {
            "bg-surface-secondary border border-border": variant === "default",
            "bg-transparent border border-border": variant === "outline",
            "bg-surface-secondary border border-border shadow-lg": variant === "elevated",
          },
          hover && "hover-lift cursor-pointer",
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

/* ── CardHeader ── */

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, bordered = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "px-5 py-4",
          bordered && "border-b border-border",
          className,
        )}
        {...props}
      />
    );
  },
);
CardHeader.displayName = "CardHeader";

/* ── CardTitle ── */

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={clsx("text-sm font-semibold text-text", className)}
        {...props}
      />
    );
  },
);
CardTitle.displayName = "CardTitle";

/* ── CardDescription ── */

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={clsx("text-xs text-text-secondary mt-1", className)}
        {...props}
      />
    );
  },
);
CardDescription.displayName = "CardDescription";

/* ── CardContent ── */

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx("px-5 py-4", className)}
        {...props}
      />
    );
  },
);
CardContent.displayName = "CardContent";

/* ── CardFooter ── */

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "px-5 py-3 border-t border-border flex items-center justify-end gap-2",
          className,
        )}
        {...props}
      />
    );
  },
);
CardFooter.displayName = "CardFooter";
