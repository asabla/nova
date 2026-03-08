import { clsx } from "clsx";

interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  label?: string;
  className?: string;
}

export function Separator({
  orientation = "horizontal",
  label,
  className,
}: SeparatorProps) {
  const isHorizontal = orientation === "horizontal";
  const decorative = !label;

  if (label && isHorizontal) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={clsx("flex items-center gap-3 my-4", className)}
      >
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-tertiary shrink-0 select-none">{label}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-hidden={decorative || undefined}
      className={clsx(
        isHorizontal
          ? "w-full h-px bg-border my-4"
          : "h-full w-px bg-border mx-2 self-stretch",
        className,
      )}
    />
  );
}
