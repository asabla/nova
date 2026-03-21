import { Zap, ListOrdered, GitBranch } from "lucide-react";
import { clsx } from "clsx";
import type { ExecutionTier } from "@nova/shared/types";

interface TierBadgeProps {
  tier: ExecutionTier;
  reasoning?: string | null;
}

const TIER_CONFIG = {
  direct: {
    icon: Zap,
    label: "Direct",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
  },
  sequential: {
    icon: ListOrdered,
    label: "Sequential",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
  orchestrated: {
    icon: GitBranch,
    label: "Orchestrated",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
  },
} as const;

export function TierBadge({ tier, reasoning }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium",
        config.bg,
        config.border,
        config.color,
      )}
      title={reasoning ?? undefined}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </div>
  );
}
