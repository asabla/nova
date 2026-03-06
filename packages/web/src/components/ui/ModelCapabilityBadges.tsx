import { clsx } from "clsx";
import {
  Eye,
  Wrench,
  Brain,
  Code,
  Zap,
  Braces,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CapabilityConfig {
  icon: LucideIcon;
  label: string;
  colorClass: string;
}

const CAPABILITY_MAP: Record<string, CapabilityConfig> = {
  vision: {
    icon: Eye,
    label: "Vision",
    colorClass: "bg-blue-500/10 text-blue-500",
  },
  "function-calling": {
    icon: Wrench,
    label: "Functions",
    colorClass: "bg-green-500/10 text-green-500",
  },
  tools: {
    icon: Wrench,
    label: "Tools",
    colorClass: "bg-green-500/10 text-green-500",
  },
  reasoning: {
    icon: Brain,
    label: "Reasoning",
    colorClass: "bg-purple-500/10 text-purple-500",
  },
  code: {
    icon: Code,
    label: "Code",
    colorClass: "bg-orange-500/10 text-orange-500",
  },
  streaming: {
    icon: Zap,
    label: "Streaming",
    colorClass: "bg-yellow-500/10 text-yellow-600",
  },
  "json-mode": {
    icon: Braces,
    label: "JSON",
    colorClass: "bg-teal-500/10 text-teal-500",
  },
  "long-context": {
    icon: Layers,
    label: "Long Context",
    colorClass: "bg-indigo-500/10 text-indigo-500",
  },
};

interface ModelCapabilityBadgesProps {
  capabilities: string[];
  /** Compact mode shows only icons without labels */
  compact?: boolean;
  className?: string;
}

export function ModelCapabilityBadges({
  capabilities,
  compact = false,
  className,
}: ModelCapabilityBadgesProps) {
  if (!capabilities || capabilities.length === 0) return null;

  return (
    <div className={clsx("flex flex-wrap gap-1", className)}>
      {capabilities.map((cap) => {
        const config = CAPABILITY_MAP[cap];
        if (!config) {
          // Fallback for unknown capabilities
          return (
            <span
              key={cap}
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-surface-tertiary text-text-secondary"
              title={cap}
            >
              {cap}
            </span>
          );
        }

        const Icon = config.icon;

        return (
          <span
            key={cap}
            className={clsx(
              "inline-flex items-center rounded-full font-medium",
              config.colorClass,
              compact
                ? "p-1"
                : "gap-1 px-1.5 py-0.5 text-[10px]",
            )}
            title={config.label}
          >
            <Icon className={compact ? "h-3 w-3" : "h-2.5 w-2.5"} />
            {!compact && config.label}
          </span>
        );
      })}
    </div>
  );
}
