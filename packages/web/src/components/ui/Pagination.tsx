import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  showInfo?: boolean;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  showInfo = false,
  className,
}: PaginationProps) {
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  const rangeStart = totalItems != null && pageSize != null
    ? (page - 1) * pageSize + 1
    : undefined;
  const rangeEnd = totalItems != null && pageSize != null
    ? Math.min(page * pageSize, totalItems)
    : undefined;

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={clsx("flex items-center justify-between gap-4", className)}
    >
      {showInfo && totalItems != null && rangeStart != null && rangeEnd != null ? (
        <p className="text-xs text-text-tertiary tabular-nums">
          Showing <span className="font-medium text-text-secondary">{rangeStart}–{rangeEnd}</span>{" "}
          of <span className="font-medium text-text-secondary">{totalItems.toLocaleString()}</span>
        </p>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirst}
          aria-label="Previous page"
          className={clsx(
            "inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-secondary transition-colors",
            "hover:bg-surface-secondary hover:text-text",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="text-xs text-text-tertiary tabular-nums px-2 select-none">
          <span className="font-medium text-text-secondary">{page}</span>
          {" / "}
          {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={isLast}
          aria-label="Next page"
          className={clsx(
            "inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-secondary transition-colors",
            "hover:bg-surface-secondary hover:text-text",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
