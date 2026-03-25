import { useState, useMemo } from "react";
import { clsx } from "clsx";
import { ChevronUp, ChevronDown, Download } from "lucide-react";

interface Column {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

function parseJSON<T>(raw: string | undefined | T, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function TableWidget({ params }: { params?: Record<string, string> }) {
  const columns = useMemo(() => parseJSON<Column[]>(params?.columns, []), [params?.columns]);
  const rows = useMemo(() => parseJSON<Record<string, string>[]>(params?.rows, []), [params?.rows]);
  const sortable = params?.sortable === "true";

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    if (!sortable || !sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortable, sortKey, sortDir]);

  function handleSort(key: string) {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportCSV() {
    const header = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const body = sortedRows
      .map((row) =>
        columns.map((c) => `"${(row[c.key] ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table-export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (columns.length === 0 || rows.length === 0) {
    return <p className="p-4 text-sm text-text-tertiary">No table data provided</p>;
  }

  return (
    <div className="px-4 py-3">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1 mb-2">
        <button
          type="button"
          onClick={exportCSV}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors"
          title="Export as CSV"
        >
          <Download className="size-4" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-secondary">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    "px-3 py-2 font-semibold text-text whitespace-nowrap",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    (!col.align || col.align === "left") && "text-left",
                    sortable && "cursor-pointer select-none hover:bg-surface-tertiary transition-colors",
                  )}
                  onClick={() => handleSort(col.key)}
                  title={col.label}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortable && sortKey === col.key && (
                      sortDir === "asc" ? (
                        <ChevronUp className="size-3 text-text-secondary" />
                      ) : (
                        <ChevronDown className="size-3 text-text-secondary" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={i}
                className={clsx(
                  "border-t border-border transition-colors hover:bg-surface-tertiary/50",
                  i % 2 === 1 && "bg-surface-tertiary/30",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "px-3 py-2 text-text-secondary truncate max-w-[200px]",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                    )}
                    title={row[col.key] ?? ""}
                  >
                    {row[col.key] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-1.5 text-[10px] text-text-tertiary">
        {sortedRows.length} {sortedRows.length === 1 ? "row" : "rows"}
      </div>
    </div>
  );
}
