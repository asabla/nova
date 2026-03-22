import { useState } from "react";
import { clsx } from "clsx";
import { Check, Square, CheckSquare, Download } from "lucide-react";

export function ChecklistWidget({ params }: { params?: Record<string, string> }) {
  const items = String(params?.items ?? "Item 1,Item 2,Item 3").split(",").map((s) => s.trim());
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

  const handleExport = () => {
    const md = items
      .map((item, i) => `- [${checked.has(i) ? "x" : " "}] ${item}`)
      .join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "checklist.md";
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[10px] text-text-tertiary">
          {completedCount}/{items.length} complete
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-text-tertiary transition-colors hover:text-text hover:bg-surface-secondary cursor-pointer"
          title="Export as Markdown"
        >
          <Download className="size-3" />
        </button>
      </div>
    </div>
  );
}
