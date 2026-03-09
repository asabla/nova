import { forwardRef, useId } from "react";
import { clsx } from "clsx";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-text">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            "min-h-[80px] rounded-lg border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-tertiary transition-colors resize-y",
            "field-glow",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:resize-none",
            error ? "border-danger" : "border-border hover:border-border-strong",
            className,
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={
            [error && errorId, helperText && helperId].filter(Boolean).join(" ") || undefined
          }
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-text-tertiary">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
