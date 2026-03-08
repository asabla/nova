import { forwardRef } from "react";
import { clsx } from "clsx";

/* ── Table ── */

export const Table = forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-auto">
      <table
        ref={ref}
        className={clsx("w-full text-sm border-collapse", className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

/* ── TableHeader ── */

export const TableHeader = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={clsx("bg-surface-secondary sticky top-0 z-10", className)}
      {...props}
    />
  ),
);
TableHeader.displayName = "TableHeader";

/* ── TableBody ── */

export const TableBody = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={clsx("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  ),
);
TableBody.displayName = "TableBody";

/* ── TableRow ── */

export const TableRow = forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={clsx(
        "border-b border-border transition-colors hover:bg-surface-secondary/50",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

/* ── TableHead ── */

export const TableHead = forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={clsx(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary",
        "[&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

/* ── TableCell ── */

export const TableCell = forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={clsx(
        "px-4 py-3 text-text align-middle",
        "[&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";
