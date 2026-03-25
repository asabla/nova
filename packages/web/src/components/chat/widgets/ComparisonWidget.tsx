import { useMemo } from "react";
import { clsx } from "clsx";
import { Scale } from "lucide-react";

interface ComparisonItem {
  name: string;
  values: Record<string, string>;
}

export function ComparisonWidget({ params }: { params?: Record<string, string> }) {
  const highlight = params?.highlight ?? "none";

  const items = useMemo<ComparisonItem[]>(() => {
    if (!params?.items) return [];
    try {
      const parsed = typeof params.items === "string" ? JSON.parse(params.items) : params.items;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item: unknown): item is ComparisonItem =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ComparisonItem).name === "string" &&
          typeof (item as ComparisonItem).values === "object" &&
          (item as ComparisonItem).values !== null,
      );
    } catch {
      return [];
    }
  }, [params?.items]);

  const dimensions = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) {
      for (const key of Object.keys(item.values)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [items]);

  const highlightedCells = useMemo(() => {
    if (highlight !== "highest" && highlight !== "lowest") return new Set<string>();

    const cells = new Set<string>();
    for (const dim of dimensions) {
      let bestIndex = -1;
      let bestValue = highlight === "highest" ? -Infinity : Infinity;

      for (let i = 0; i < items.length; i++) {
        const raw = items[i].values[dim];
        if (raw == null) continue;
        const num = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
        if (isNaN(num)) continue;

        if (
          (highlight === "highest" && num > bestValue) ||
          (highlight === "lowest" && num < bestValue)
        ) {
          bestValue = num;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        cells.add(`${dim}:${bestIndex}`);
      }
    }
    return cells;
  }, [items, dimensions, highlight]);

  if (items.length === 0 || dimensions.length === 0) {
    return <p className="p-4 text-sm text-text-tertiary">No comparison data provided</p>;
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Scale className="size-3.5 text-text-tertiary" />
        <span className="text-xs font-medium text-text">Comparison</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-secondary">
              <th className="text-left px-3 py-2 text-text-secondary font-medium" />
              {items.map((item, i) => (
                <th
                  key={i}
                  className="text-left px-3 py-2 font-medium text-text"
                  title={item.name}
                >
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dim, rowIndex) => (
              <tr
                key={dim}
                className={clsx(rowIndex % 2 === 1 && "bg-surface-tertiary/30")}
              >
                <td
                  className="px-3 py-2 text-text-secondary font-medium whitespace-nowrap"
                  title={dim}
                >
                  {dim}
                </td>
                {items.map((item, colIndex) => {
                  const value = item.values[dim] ?? "—";
                  const isHighlighted = highlightedCells.has(`${dim}:${colIndex}`);
                  return (
                    <td
                      key={colIndex}
                      className={clsx(
                        "px-3 py-2",
                        isHighlighted
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-text",
                      )}
                      title={value}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
