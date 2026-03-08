import { useCallback, useId } from "react";
import { clsx } from "clsx";

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  size = "md",
  className,
}: SwitchProps) {
  const id = useId();
  const descId = `${id}-desc`;

  const handleToggle = useCallback(() => {
    if (!disabled) onChange?.(!checked);
  }, [checked, disabled, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle],
  );

  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? id : undefined}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={clsx(
        "relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-primary" : "bg-border-strong",
        {
          "h-4 w-7": size === "sm",
          "h-5 w-9": size === "md",
        },
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out",
          {
            "h-3 w-3": size === "sm",
            "h-4 w-4": size === "md",
          },
          size === "sm" && (checked ? "translate-x-3.5" : "translate-x-0.5"),
          size === "md" && (checked ? "translate-x-4.5" : "translate-x-0.5"),
          size === "sm" ? "mt-0.5" : "mt-0.5",
        )}
      />
    </button>
  );

  if (!label) return track;

  return (
    <label className={clsx("flex items-start gap-3 cursor-pointer", disabled && "opacity-50 cursor-not-allowed")}>
      <div className="pt-0.5 shrink-0">{track}</div>
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
