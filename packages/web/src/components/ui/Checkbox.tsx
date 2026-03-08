import { useCallback, useId } from "react";
import { clsx } from "clsx";

interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

export function Checkbox({
  checked = false,
  onChange,
  indeterminate = false,
  disabled = false,
  label,
  description,
  className,
}: CheckboxProps) {
  const id = useId();
  const descId = `${id}-desc`;

  const handleToggle = useCallback(() => {
    if (!disabled) onChange?.(!checked);
  }, [checked, disabled, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle],
  );

  const ariaChecked = indeterminate ? "mixed" as const : checked;
  const isActive = checked || indeterminate;

  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={ariaChecked}
      aria-labelledby={label ? id : undefined}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={clsx(
        "inline-flex items-center justify-center shrink-0 h-4 w-4 rounded border transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isActive
          ? "bg-primary border-primary"
          : "bg-transparent border-border-strong hover:border-primary/60",
        className,
      )}
    >
      {checked && !indeterminate && (
        <svg
          className="h-3 w-3 text-primary-foreground"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 6L5 8.5L9.5 3.5" />
        </svg>
      )}
      {indeterminate && (
        <svg
          className="h-3 w-3 text-primary-foreground"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 6H9" />
        </svg>
      )}
    </button>
  );

  if (!label) return box;

  return (
    <label
      className={clsx(
        "flex items-start gap-3 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div className="pt-0.5 shrink-0">{box}</div>
      <div>
        <span id={id} className="text-sm font-medium text-text">
          {label}
        </span>
        {description && (
          <p id={descId} className="text-xs text-text-tertiary mt-0.5">
            {description}
          </p>
        )}
      </div>
    </label>
  );
}
