import { clsx } from "clsx";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={clsx("animate-pulse rounded-lg bg-surface-tertiary", className)} aria-hidden="true" />
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-4" aria-busy="true" aria-label="Loading messages">
      <Skeleton className="h-7 w-7 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function ConversationListSkeleton() {
  return (
    <div className="space-y-1 px-2" aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-surface-secondary border border-border" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-10 rounded-xl mb-3" />
      <Skeleton className="h-4 w-2/3 mb-2" />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
