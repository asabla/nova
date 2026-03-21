import type { Plan, PlanNode, PlanNodeStatus } from "@nova/shared/types";

/**
 * Returns nodes whose dependencies have all completed, making them ready to execute.
 * Pure function — safe to call inside Temporal workflow deterministic code.
 */
export function getReadyNodes(plan: Plan): PlanNode[] {
  return plan.nodes.filter(
    (node) =>
      (node.status === "pending" || node.status === "ready") &&
      node.dependencies.every((depId) => {
        const dep = plan.nodes.find((n) => n.id === depId);
        return dep?.status === "completed";
      }),
  );
}

/**
 * Update a node's status in-place and return the mutated plan.
 * Marks newly-unblocked nodes as "ready".
 */
export function updateNodeStatus(
  plan: Plan,
  nodeId: string,
  status: PlanNodeStatus,
): Plan {
  const node = plan.nodes.find((n) => n.id === nodeId);
  if (node) {
    node.status = status;
  }

  // After updating, mark any newly-ready nodes
  if (status === "completed" || status === "failed" || status === "skipped") {
    for (const n of plan.nodes) {
      if (n.status !== "pending") continue;
      const allDepsDone = n.dependencies.every((depId) => {
        const dep = plan.nodes.find((d) => d.id === depId);
        return dep?.status === "completed";
      });
      if (allDepsDone) {
        n.status = "ready";
      }
    }
  }

  return plan;
}

/**
 * Returns true when every node has reached a terminal state
 * (completed, failed, or skipped).
 */
export function isPlanComplete(plan: Plan): boolean {
  return plan.nodes.every(
    (n) => n.status === "completed" || n.status === "failed" || n.status === "skipped",
  );
}

/**
 * Returns true if the plan has any failed nodes.
 */
export function hasPlanFailures(plan: Plan): boolean {
  return plan.nodes.some((n) => n.status === "failed");
}

/**
 * Validates plan structure:
 * - No cycles
 * - All dependency references are valid node IDs
 * - At least one root node (no dependencies)
 */
export function validatePlan(plan: Plan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(plan.nodes.map((n) => n.id));

  // Check for duplicate IDs
  if (nodeIds.size !== plan.nodes.length) {
    errors.push("Duplicate node IDs found");
  }

  // Check all dependency references are valid
  for (const node of plan.nodes) {
    for (const depId of node.dependencies) {
      if (!nodeIds.has(depId)) {
        errors.push(`Node "${node.id}" depends on unknown node "${depId}"`);
      }
      if (depId === node.id) {
        errors.push(`Node "${node.id}" depends on itself`);
      }
    }
  }

  // Check for at least one root
  const roots = plan.nodes.filter((n) => n.dependencies.length === 0);
  if (roots.length === 0 && plan.nodes.length > 0) {
    errors.push("No root nodes found (every node has dependencies)");
  }

  // Check for cycles using DFS
  if (errors.length === 0) {
    const cycleError = detectCycle(plan.nodes);
    if (cycleError) errors.push(cycleError);
  }

  return { valid: errors.length === 0, errors };
}

function detectCycle(nodes: PlanNode[]): string | null {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function dfs(id: string): string | null {
    if (visiting.has(id)) return `Cycle detected involving node "${id}"`;
    if (visited.has(id)) return null;

    visiting.add(id);
    const node = nodeMap.get(id);
    if (node) {
      for (const depId of node.dependencies) {
        const err = dfs(depId);
        if (err) return err;
      }
    }
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const node of nodes) {
    const err = dfs(node.id);
    if (err) return err;
  }
  return null;
}

/**
 * Returns nodes in topological order (dependencies first).
 * Useful for UI rendering and sequential execution.
 */
export function topologicalSort(plan: Plan): PlanNode[] {
  const sorted: PlanNode[] = [];
  const visited = new Set<string>();
  const nodeMap = new Map(plan.nodes.map((n) => [n.id, n]));

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) return;
    for (const depId of node.dependencies) {
      visit(depId);
    }
    sorted.push(node);
  }

  for (const node of plan.nodes) {
    visit(node.id);
  }

  return sorted;
}
