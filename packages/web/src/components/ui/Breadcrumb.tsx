import { forwardRef, useState, Children, type ReactNode, type ReactElement, isValidElement } from "react";
import { clsx } from "clsx";
import { ChevronRight, MoreHorizontal } from "lucide-react";

/* ── Breadcrumb ── */

interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  maxItems?: number;
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(
  ({ className, maxItems = 4, children, ...props }, ref) => {
    const [expanded, setExpanded] = useState(false);
    const items = Children.toArray(children).filter(isValidElement) as ReactElement[];
    const needsTruncation = !expanded && items.length > maxItems;

    let visibleItems: ReactNode[];

    if (needsTruncation) {
      const first = items[0];
      const last = items.slice(-2);
      visibleItems = [
        first,
        <li key="__ellipsis" className="flex items-center">
          <BreadcrumbSeparator />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center justify-center h-6 w-6 rounded-md text-text-tertiary hover:text-text hover:bg-surface-secondary transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            aria-label={`Show ${items.length - 3} more items`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </li>,
        ...last,
      ];
    } else {
      visibleItems = items;
    }

    return (
      <nav ref={ref} aria-label="Breadcrumb" className={className} {...props}>
        <ol className="flex items-center flex-wrap gap-0.5">
          {visibleItems.map((item, idx) => {
            const isFirst = idx === 0;
            const isEllipsis = isValidElement(item) && item.key === "__ellipsis";
            if (isEllipsis) return item;

            return (
              <li key={isValidElement(item) ? item.key ?? idx : idx} className="flex items-center">
                {!isFirst && <BreadcrumbSeparator />}
                {item}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  },
);
Breadcrumb.displayName = "Breadcrumb";

/* ── BreadcrumbItem ── */

interface BreadcrumbItemProps {
  href?: string;
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const BreadcrumbItem = forwardRef<HTMLAnchorElement | HTMLSpanElement, BreadcrumbItemProps>(
  ({ href, active = false, icon, children, className, onClick }, ref) => {
    const content = (
      <>
        {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
        <span className="truncate max-w-[160px]">{children}</span>
      </>
    );

    if (active || !href) {
      return (
        <span
          ref={ref as React.Ref<HTMLSpanElement>}
          aria-current={active ? "page" : undefined}
          className={clsx(
            "inline-flex items-center gap-1.5 text-sm",
            active ? "font-medium text-text" : "text-text-secondary",
            className,
          )}
        >
          {content}
        </span>
      );
    }

    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        onClick={onClick}
        className={clsx(
          "inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm",
          "hover:underline underline-offset-2 decoration-border-strong",
          className,
        )}
      >
        {content}
      </a>
    );
  },
);
BreadcrumbItem.displayName = "BreadcrumbItem";

/* ── BreadcrumbSeparator ── */

export function BreadcrumbSeparator({ className }: { className?: string }) {
  return (
    <ChevronRight
      className={clsx("h-3.5 w-3.5 mx-1 text-text-tertiary shrink-0", className)}
      aria-hidden="true"
    />
  );
}
