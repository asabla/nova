import { describe, it, expect } from "bun:test";
import {
  computeRerunPlan,
  computeEditAndRerunPlan,
  type RerunMessage,
} from "../src/lib/rerun";

// A short linear conversation: user -> assistant -> user -> assistant
const conversation: RerunMessage[] = [
  { id: "u1", parentMessageId: null, senderType: "user", content: "hello" },
  { id: "a1", parentMessageId: "u1", senderType: "assistant", content: "hi" },
  { id: "u2", parentMessageId: "a1", senderType: "user", content: "how are you?" },
  { id: "a2", parentMessageId: "u2", senderType: "assistant", content: "good" },
];

describe("computeRerunPlan", () => {
  it("rerunning an assistant message anchors on its parent user message", () => {
    const plan = computeRerunPlan(conversation, "a2");
    expect(plan).not.toBeNull();
    expect(plan!.anchorId).toBe("u2");
    expect(plan!.parentMessageId).toBe("u2");
    expect(plan!.history.map((m) => m.id)).toEqual(["u1", "a1", "u2"]);
  });

  it("rerunning a user message anchors on itself", () => {
    const plan = computeRerunPlan(conversation, "u2");
    expect(plan).not.toBeNull();
    expect(plan!.anchorId).toBe("u2");
    expect(plan!.history.map((m) => m.id)).toEqual(["u1", "a1", "u2"]);
  });

  it("rerunning the first user message includes only itself in history", () => {
    const plan = computeRerunPlan(conversation, "u1");
    expect(plan).not.toBeNull();
    expect(plan!.anchorId).toBe("u1");
    expect(plan!.history.map((m) => m.id)).toEqual(["u1"]);
  });

  it("rerunning the first assistant message anchors on the root user message", () => {
    const plan = computeRerunPlan(conversation, "a1");
    expect(plan).not.toBeNull();
    expect(plan!.anchorId).toBe("u1");
    expect(plan!.history.map((m) => m.id)).toEqual(["u1"]);
  });

  it("returns null when the message doesn't exist", () => {
    expect(computeRerunPlan(conversation, "missing")).toBeNull();
  });

  it("returns null for an orphan assistant message with no parent", () => {
    const broken: RerunMessage[] = [
      { id: "a", parentMessageId: null, senderType: "assistant", content: "?" },
    ];
    expect(computeRerunPlan(broken, "a")).toBeNull();
  });

  it("returns null when the anchor's parent is not in the list", () => {
    const orphaned: RerunMessage[] = [
      { id: "a", parentMessageId: "ghost", senderType: "assistant", content: "?" },
    ];
    expect(computeRerunPlan(orphaned, "a")).toBeNull();
  });

  it("history for rerun never contains messages after the anchor", () => {
    const plan = computeRerunPlan(conversation, "u1");
    expect(plan!.history.map((m) => m.id)).not.toContain("a1");
    expect(plan!.history.map((m) => m.id)).not.toContain("a2");
  });
});

describe("computeEditAndRerunPlan", () => {
  it("anchors on the user message being edited and excludes it from history", () => {
    const plan = computeEditAndRerunPlan(conversation, "u2");
    expect(plan).not.toBeNull();
    expect(plan!.anchorId).toBe("u2");
    expect(plan!.parentMessageId).toBe("u2");
    // History stops BEFORE the edited message — the caller appends the new content
    expect(plan!.history.map((m) => m.id)).toEqual(["u1", "a1"]);
  });

  it("editing the first user message yields an empty history", () => {
    const plan = computeEditAndRerunPlan(conversation, "u1");
    expect(plan).not.toBeNull();
    expect(plan!.anchorId).toBe("u1");
    expect(plan!.history).toEqual([]);
  });

  it("returns null when trying to edit an assistant message", () => {
    expect(computeEditAndRerunPlan(conversation, "a1")).toBeNull();
    expect(computeEditAndRerunPlan(conversation, "a2")).toBeNull();
  });

  it("returns null when the message doesn't exist", () => {
    expect(computeEditAndRerunPlan(conversation, "missing")).toBeNull();
  });

  it("anchor always matches the messageId for user edits", () => {
    const plan = computeEditAndRerunPlan(conversation, "u2");
    expect(plan!.anchorId).toBe("u2");
    expect(plan!.parentMessageId).toBe("u2");
  });
});
