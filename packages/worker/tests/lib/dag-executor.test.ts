import { describe, it, expect } from "bun:test";
import {
  getReadyNodes,
  updateNodeStatus,
  isPlanComplete,
  hasPlanFailures,
  validatePlan,
  topologicalSort,
} from "../../src/lib/dag-executor";
import type { Plan, PlanNode } from "@nova/shared/types";

function makePlan(nodes: Partial<PlanNode>[]): Plan {
  return {
    id: "test-plan",
    tier: "orchestrated",
    reasoning: "test",
    nodes: nodes.map((n, i) => ({
      id: n.id ?? `step-${i + 1}`,
      description: n.description ?? `Step ${i + 1}`,
      dependencies: n.dependencies ?? [],
      status: n.status ?? "pending",
      tools: n.tools,
      subPlan: n.subPlan,
    })),
    approvalRequired: false,
  };
}

// ---------------------------------------------------------------------------
// getReadyNodes
// ---------------------------------------------------------------------------

describe("getReadyNodes", () => {
  it("returns root nodes (no dependencies) when all are pending", () => {
    const plan = makePlan([
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["a"] },
      { id: "c", dependencies: ["a"] },
    ]);
    const ready = getReadyNodes(plan);
    expect(ready.map((n) => n.id)).toEqual(["a"]);
  });

  it("returns multiple root nodes in parallel", () => {
    const plan = makePlan([
      { id: "a", dependencies: [] },
      { id: "b", dependencies: [] },
      { id: "c", dependencies: ["a", "b"] },
    ]);
    const ready = getReadyNodes(plan);
    expect(ready.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("returns nothing when all nodes are completed", () => {
    const plan = makePlan([
      { id: "a", dependencies: [], status: "completed" },
      { id: "b", dependencies: ["a"], status: "completed" },
    ]);
    expect(getReadyNodes(plan)).toEqual([]);
  });

  it("returns downstream nodes when dependencies complete", () => {
    const plan = makePlan([
      { id: "a", dependencies: [], status: "completed" },
      { id: "b", dependencies: ["a"] },
      { id: "c", dependencies: ["a"] },
    ]);
    const ready = getReadyNodes(plan);
    expect(ready.map((n) => n.id).sort()).toEqual(["b", "c"]);
  });

  it("does not return nodes whose deps are only partially completed", () => {
    const plan = makePlan([
      { id: "a", dependencies: [], status: "completed" },
      { id: "b", dependencies: [], status: "pending" },
      { id: "c", dependencies: ["a", "b"] },
    ]);
    const ready = getReadyNodes(plan);
    // Only "b" is ready (it has no deps and is pending). "c" needs both a & b.
    expect(ready.map((n) => n.id)).toEqual(["b"]);
  });

  it("handles diamond dependency pattern", () => {
    //   a
    //  / \
    // b   c
    //  \ /
    //   d
    const plan = makePlan([
      { id: "a", dependencies: [], status: "completed" },
      { id: "b", dependencies: ["a"], status: "completed" },
      { id: "c", dependencies: ["a"], status: "completed" },
      { id: "d", dependencies: ["b", "c"] },
    ]);
    const ready = getReadyNodes(plan);
    expect(ready.map((n) => n.id)).toEqual(["d"]);
  });

  it("does not return nodes that are already running", () => {
    const plan = makePlan([
      { id: "a", dependencies: [], status: "running" },
      { id: "b", dependencies: ["a"] },
    ]);
    expect(getReadyNodes(plan)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateNodeStatus
// ---------------------------------------------------------------------------

describe("updateNodeStatus", () => {
  it("updates node status and marks downstream as ready", () => {
    const plan = makePlan([
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["a"] },
    ]);
    updateNodeStatus(plan, "a", "completed");
    expect(plan.nodes[0].status).toBe("completed");
    expect(plan.nodes[1].status).toBe("ready");
  });

  it("does not mark downstream ready if other deps are pending", () => {
    const plan = makePlan([
      { id: "a", dependencies: [] },
      { id: "b", dependencies: [] },
      { id: "c", dependencies: ["a", "b"] },
    ]);
    updateNodeStatus(plan, "a", "completed");
    expect(plan.nodes[2].status).toBe("pending"); // b is still pending
  });

  it("handles failed status without promoting downstream", () => {
    const plan = makePlan([
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["a"] },
    ]);
    updateNodeStatus(plan, "a", "failed");
    // b depends on a, but a failed (not completed), so b stays pending
    expect(plan.nodes[1].status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// isPlanComplete / hasPlanFailures
// ---------------------------------------------------------------------------

describe("isPlanComplete", () => {
  it("returns false when nodes are pending", () => {
    const plan = makePlan([
      { id: "a", status: "completed" },
      { id: "b", status: "pending" },
    ]);
    expect(isPlanComplete(plan)).toBe(false);
  });

  it("returns true when all nodes are in terminal states", () => {
    const plan = makePlan([
      { id: "a", status: "completed" },
      { id: "b", status: "failed" },
      { id: "c", status: "skipped" },
    ]);
    expect(isPlanComplete(plan)).toBe(true);
  });

  it("returns false when a node is running", () => {
    const plan = makePlan([
      { id: "a", status: "completed" },
      { id: "b", status: "running" },
    ]);
    expect(isPlanComplete(plan)).toBe(false);
  });
});

describe("hasPlanFailures", () => {
  it("returns false when no failures", () => {
    const plan = makePlan([{ id: "a", status: "completed" }]);
    expect(hasPlanFailures(plan)).toBe(false);
  });

  it("returns true when any node failed", () => {
    const plan = makePlan([
      { id: "a", status: "completed" },
      { id: "b", status: "failed" },
    ]);
    expect(hasPlanFailures(plan)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validatePlan
// ---------------------------------------------------------------------------

describe("validatePlan", () => {
  it("accepts a valid linear plan", () => {
    const plan = makePlan([
      { id: "step-1", dependencies: [] },
      { id: "step-2", dependencies: ["step-1"] },
      { id: "step-3", dependencies: ["step-2"] },
    ]);
    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid DAG with parallelism", () => {
    const plan = makePlan([
      { id: "a", dependencies: [] },
      { id: "b", dependencies: [] },
      { id: "c", dependencies: ["a", "b"] },
    ]);
    expect(validatePlan(plan).valid).toBe(true);
  });

  it("rejects unknown dependency references", () => {
    const plan = makePlan([
      { id: "a", dependencies: ["nonexistent"] },
    ]);
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("nonexistent");
  });

  it("rejects self-referencing dependencies", () => {
    const plan = makePlan([
      { id: "a", dependencies: ["a"] },
    ]);
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("depends on itself");
  });

  it("rejects plans with no root nodes", () => {
    const plan = makePlan([
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["a"] },
    ]);
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
  });

  it("detects cycles", () => {
    const plan = makePlan([
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["c"] },
      { id: "c", dependencies: ["b"] },
    ]);
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Cycle"))).toBe(true);
  });

  it("accepts empty plan", () => {
    const plan = makePlan([]);
    expect(validatePlan(plan).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// topologicalSort
// ---------------------------------------------------------------------------

describe("topologicalSort", () => {
  it("returns nodes in dependency order", () => {
    const plan = makePlan([
      { id: "c", dependencies: ["b"] },
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["a"] },
    ]);
    const sorted = topologicalSort(plan);
    const ids = sorted.map((n) => n.id);
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("c"));
  });

  it("handles parallel roots", () => {
    const plan = makePlan([
      { id: "a", dependencies: [] },
      { id: "b", dependencies: [] },
      { id: "c", dependencies: ["a", "b"] },
    ]);
    const sorted = topologicalSort(plan);
    const ids = sorted.map((n) => n.id);
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("c"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("c"));
  });
});
