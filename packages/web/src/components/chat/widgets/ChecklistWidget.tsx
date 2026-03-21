import { useState } from "react";
import { clsx } from "clsx";
import { Check, Square, CheckSquare } from "lucide-react";

export function ChecklistWidget({ params }: { params?: Record<string, string> }) {
  const items = (params?.items ?? "Item 1,Item 2,Item 3").split(",").map((s) => s.trim());
  const [checked, setChecked] = useState<Set<number>>(() => {
    if (!params?.checked) return new Set();
    return new Set(
      params.checked
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 0 && n < items.length),
    );
  });

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const completedCount = checked.size;

  return (
    <div className="px-4 py-3">
      <div className="space-y-1">
        {items.map((item, i) => {
          const isChecked = checked.has(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors hover:bg-surface-secondary cursor-pointer"
            >
              <span
                className={clsx(
                  "flex-shrink-0 transition-colors",
                  isChecked ? "text-primary" : "text-text-tertiary",
                )}
              >
                {isChecked ? (
                  <CheckSquare className="size-4" />
                ) : (
                  <Square className="size-4" />
                )}
              </span>
              <span
                className={clsx(
                  "transition-all",
                  isChecked
                    ? "line-through text-text-tertiary opacity-60"
                    : "text-text",
                )}
              >
                {item}
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-text-tertiary mt-2">
        {completedCount}/{items.length} complete
      </div>
    </div>
  );
}
