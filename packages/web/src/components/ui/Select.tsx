import { useState, useRef, useEffect, useCallback, useId } from "react";
import { clsx } from "clsx";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select…",
  label,
  error,
  helperText,
  disabled = false,
  size = "md",
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [typeahead, setTypeahead] = useState("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const listboxId = `${generatedId}-listbox`;
  const errorId = `${generatedId}-error`;
  const helperId = `${generatedId}-helper`;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const enabledOptions = options.filter((o) => !o.disabled);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [open]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (!open || highlightedIndex < 0) return;
    const item = listRef.current?.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [open, highlightedIndex]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    const selectedIdx = options.findIndex((o) => o.value === value);
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [disabled, options, value]);

  const selectOption = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      onChange?.(option.value);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (!open) {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          openDropdown();
        }
        return;
      }

      switch (e.key) {
        case "Escape": {
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          setHighlightedIndex((prev) => {
            for (let i = prev + 1; i < options.length; i++) {
              if (!options[i].disabled) return i;
            }
            return prev;
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setHighlightedIndex((prev) => {
            for (let i = prev - 1; i >= 0; i--) {
              if (!options[i].disabled) return i;
            }
            return prev;
          });
          break;
        }
        case "Home": {
          e.preventDefault();
          const first = options.findIndex((o) => !o.disabled);
          if (first >= 0) setHighlightedIndex(first);
          break;
        }
        case "End": {
          e.preventDefault();
          for (let i = options.length - 1; i >= 0; i--) {
            if (!options[i].disabled) {
              setHighlightedIndex(i);
              break;
            }
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            selectOption(options[highlightedIndex]);
          }
          break;
        }
        default: {
          // Type-ahead
          if (e.key.length === 1) {
            const query = typeahead + e.key.toLowerCase();
            setTypeahead(query);
            clearTimeout(typeaheadTimer.current);
            typeaheadTimer.current = setTimeout(() => setTypeahead(""), 400);

            const match = enabledOptions.findIndex((o) =>
              o.label.toLowerCase().startsWith(query),
            );
            if (match >= 0) {
              const realIndex = options.indexOf(enabledOptions[match]);
              setHighlightedIndex(realIndex);
            }
          }
        }
      }
    },
    [disabled, open, openDropdown, options, highlightedIndex, selectOption, typeahead, enabledOptions],
  );

  const describedBy = [error ? errorId : null, helperText ? helperId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div ref={containerRef} className={clsx("flex flex-col gap-1.5", className)}>
      {label && (
        <label id={labelId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        onKeyDown={handleKeyDown}
        className={clsx(
          "relative w-full flex items-center justify-between rounded-lg border bg-surface text-left text-sm transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary focus-visible:border-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border-danger" : "border-border hover:border-border-strong",
          size === "sm" ? "h-8 px-2.5" : "h-10 px-3",
        )}
      >
        <span className={clsx(!selectedOption && "text-text-tertiary")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={clsx(
            "h-4 w-4 text-text-tertiary shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="relative">
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
            className="absolute top-0 left-0 z-50 w-full max-h-60 overflow-auto rounded-xl border border-border bg-surface shadow-lg py-1 animate-in"
            style={{ animation: "scale-in 150ms cubic-bezier(0.16,1,0.3,1) both" }}
          >
            {options.map((option, idx) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                data-highlighted={idx === highlightedIndex || undefined}
                onClick={() => selectOption(option)}
                onMouseEnter={() => !option.disabled && setHighlightedIndex(idx)}
                className={clsx(
                  "flex items-center gap-2 px-3 text-sm cursor-default select-none transition-colors",
                  size === "sm" ? "py-1.5" : "py-2",
                  option.disabled && "opacity-40 cursor-not-allowed",
                  !option.disabled && idx === highlightedIndex && "bg-surface-secondary text-text",
                  !option.disabled && idx !== highlightedIndex && "text-text-secondary",
                  option.value === value && "font-medium text-text",
                )}
              >
                <span className="flex-1 truncate">{option.label}</span>
                {option.value === value && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                )}
              </li>
            ))}
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-text-tertiary">No options</li>
            )}
          </ul>
        </div>
      )}

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
}
