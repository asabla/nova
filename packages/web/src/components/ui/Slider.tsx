import { useCallback, useId, useRef, useState } from "react";
import { clsx } from "clsx";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  disabled = false,
  className,
}: SliderProps) {
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const percent = ((value - min) / (max - min)) * 100;

  const clampValue = useCallback(
    (raw: number) => {
      const stepped = Math.round(raw / step) * step;
      return Math.min(max, Math.max(min, stepped));
    },
    [min, max, step],
  );

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return clampValue(min + ratio * (max - min));
    },
    [min, max, value, clampValue],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      onChange(valueFromPointer(e.clientX));
    },
    [disabled, onChange, valueFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || disabled) return;
      onChange(valueFromPointer(e.clientX));
    },
    [isDragging, disabled, onChange, valueFromPointer],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      let next = value;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        next = clampValue(value + step);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        next = clampValue(value - step);
      } else if (e.key === "Home") {
        e.preventDefault();
        next = min;
      } else if (e.key === "End") {
        e.preventDefault();
        next = max;
      } else {
        return;
      }
      onChange(next);
    },
    [disabled, value, step, min, max, onChange, clampValue],
  );

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={id} className="text-sm font-medium text-text">
              {label}
            </label>
          )}
          {showValue && (
            <span
              className={clsx(
                "text-xs font-medium tabular-nums rounded-md px-1.5 py-0.5 transition-colors",
                isDragging || isFocused
                  ? "bg-primary/10 text-primary"
                  : "bg-surface-tertiary text-text-secondary",
              )}
            >
              {value}
            </span>
          )}
        </div>
      )}

      <div
        ref={trackRef}
        role="slider"
        id={id}
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        aria-disabled={disabled || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={clsx(
          "relative h-5 flex items-center select-none touch-none",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          "focus-visible:outline-none",
        )}
      >
        {/* Track */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-surface-tertiary">
          {/* Filled portion */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-75"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className={clsx(
            "absolute h-4 w-4 -translate-x-1/2 rounded-full bg-white border-2 border-primary shadow-sm transition-shadow",
            (isDragging || isFocused) && "ring-4 ring-primary/20 shadow-md",
            !disabled && "hover:shadow-md",
          )}
          style={{ left: `${percent}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
