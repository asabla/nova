import { useState } from "react";
import {
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  SkipForward,
} from "lucide-react";
import { clsx } from "clsx";
import type { Plan, PlanNode, PlanNodeStatus } from "@nova/shared/types";

interface PlanDAGViewProps {
  plan: Plan;
  isRunning?: boolean;
  defaultCollapsed?: boolean;
}

const STATUS_CONFIG: Record<PlanNodeStatus, {
  icon: typeof Check | null;
  color: string;
  borderColor: string;
  animate?: boolean;
}> = {
  pending: { icon: Clock, color: "text-text-tertiary", borderColor: "border-border" },
  ready: { icon: null, color: "text-text-secondary", borderColor: "border-primary/30" },
  running: { icon: Loader2, color: "text-primary", borderColor: "border-primary", animate: true },
  completed: { icon: Check, color: "text-success", borderColor: "border-success/50" },
  failed: { icon: AlertCircle, color: "text-danger", borderColor: "border-danger/50" },
  skipped: { icon: SkipForward, color: "text-text-tertiary", borderColor: "border-border" },
};

function PlanNodeRow({ node, depth = 0, allNodes }: { node: PlanNode; depth?: number; allNodes: PlanNode[] }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[node.status];
  const StatusIcon = config.icon;
  const hasResult = !!node.result;
  const dependents = allNodes.filter((n) => n.dependencies.includes(node.id));

  return (
    <div className={clsx("relative", depth > 0 && "ml-5")}>
      {/* Dependency line */}
      {depth > 0 && (
        <div className="absolute -left-2.5 top-0 bottom-0 w-px bg-border" />
      )}

      <div className={clsx("border-l-2 pl-3 py-1.5", config.borderColor)}>
        <button
          type="button"
          onClick={() => hasResult && setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left group"
          disabled={!hasResult}
        >
          {/* Status icon */}
          <span className="shrink-0 w-4 h-4 flex items-center justify-center">
            {StatusIcon ? (
              <StatusIcon className={clsx("h-3.5 w-3.5", config.color, config.animate && "animate-spin")} />
            ) : (
              <span className={clsx("inline-block h-2.5 w-2.5 rounded-full border-2", config.borderColor)} />
            )}
          </span>

          {/* Description */}
          <span
            className={clsx(
              "text-sm flex-1 min-w-0 truncate",
              node.status === "completed" ? "text-text-secondary line-through" : "text-text",
              node.status === "running" && "font-medium",
            )}
          >
            {node.description}
          </span>

          {/* Tools badge */}
          {node.tools && node.tools.length > 0 && (
            <span className="text-[10px] text-text-tertiary bg-muted px-1.5 py-0.5 rounded">
              {node.tools.join(", ")}
            </span>
          )}

          {/* Duration */}
          {node.result?.durationMs != null && (
            <span className="text-[10px] text-text-tertiary">
              {(node.result.durationMs / 1000).toFixed(1)}s
            </span>
          )}

          {/* Expand indicator */}
          {hasResult && (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            )
          )}
        </button>

        {/* Expanded result content */}
        {expanded && node.result && (
          <div className="mt-1.5 ml-6">
            <pre className="text-xs text-text-secondary bg-surface rounded-lg p-2.5 overflow-x-auto font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
              {node.result.content.slice(0, 500)}
              {node.result.content.length > 500 && "..."}
            </pre>
            {node.result.toolCallRecords.length > 0 && (
              <p className="text-[10px] text-text-tertiary mt-1">
                {node.result.toolCallRecords.length} tool call(s), {node.result.tokensUsed} tokens
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanDAGView({ plan, isRunning, defaultCollapsed = false }: PlanDAGViewProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const completedCount = plan.nodes.filter((n) => n.status === "completed").length;
  const totalNodes = plan.nodes.length;

  // Group nodes into execution layers (topological depth)
  const layers = computeLayers(plan.nodes);

  return (
    <div className="mx-4 my-2 rounded-lg border border-border bg-card text-card-foreground overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50"
      >
        <span className="text-primary">Plan</span>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{totalNodes} steps
        </span>
        {plan.approvalRequired && !plan.approved && (
          <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded">
            Awaiting approval
          </span>
        )}
        {isRunning && (
          <Loader2 className="h-3 w-3 text-primary animate-spin" />
        )}
        <span className="ml-auto">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-0.5">
          {plan.reasoning && (
            <p className="text-xs text-muted-foreground italic mb-2">{plan.reasoning}</p>
          )}

          {/* Render nodes layer by layer */}
          {layers.map((layer, layerIdx) => (
            <div key={layerIdx}>
              {layer.length > 1 && (
                <div className="flex items-center gap-1 ml-3 my-1">
                  <span className="text-[10px] text-text-tertiary">parallel</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              {layer.map((node) => (
                <PlanNodeRow key={node.id} node={node} allNodes={plan.nodes} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compute execution layers for the DAG (nodes at the same "depth" can run in parallel).
 */
function computeLayers(nodes: PlanNode[]): PlanNode[][] {
  const layers: PlanNode[][] = [];
  const assigned = new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function getDepth(id: string, visited = new Set<string>()): number {
    if (visited.has(id)) return 0; // cycle protection
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node || node.dependencies.length === 0) return 0;
    return 1 + Math.max(...node.dependencies.map((d) => getDepth(d, visited)));
  }

  // Compute depth for each node
  const depths = new Map<string, number>();
  for (const node of nodes) {
    depths.set(node.id, getDepth(node.id));
  }

  // Group by depth
  const maxDepth = Math.max(0, ...depths.values());
  for (let d = 0; d <= maxDepth; d++) {
    const layer = nodes.filter((n) => depths.get(n.id) === d && !assigned.has(n.id));
    if (layer.length > 0) {
      layers.push(layer);
      layer.forEach((n) => assigned.add(n.id));
    }
  }

  // Add any unassigned nodes (shouldn't happen, but safety)
  const remaining = nodes.filter((n) => !assigned.has(n.id));
  if (remaining.length > 0) layers.push(remaining);

  return layers;
}
