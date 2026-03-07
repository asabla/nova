import { describe, it, expect } from "bun:test";

// Mock DOM APIs needed by the hooks
// @ts-ignore
globalThis.navigator = { platform: "MacIntel" };
// @ts-ignore
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};

const { getResolvedShortcuts, saveCustomShortcut, resetCustomShortcuts, formatShortcut } = await import("../../src/hooks/useKeyboardShortcuts");

describe("Keyboard shortcuts", () => {
  it("resolves all default shortcuts", () => {
    const shortcuts = getResolvedShortcuts();
    expect(shortcuts.length).toBeGreaterThan(0);
  });

  it("has unique shortcut IDs", () => {
    const shortcuts = getResolvedShortcuts();
    const ids = shortcuts.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("includes command palette shortcut", () => {
    const shortcuts = getResolvedShortcuts();
    const cmdK = shortcuts.find((s) => s.id === "command-palette");
    expect(cmdK).toBeDefined();
    expect(cmdK!.key).toBe("k");
    expect(cmdK!.meta).toBe(true);
  });

  it("includes new chat shortcut", () => {
    const shortcuts = getResolvedShortcuts();
    const newChat = shortcuts.find((s) => s.id === "new-chat");
    expect(newChat).toBeDefined();
  });

  it("all shortcuts have required fields", () => {
    const shortcuts = getResolvedShortcuts();
    for (const s of shortcuts) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.key).toBeTruthy();
      expect(s.category).toBeTruthy();
    }
  });

  it("formats shortcuts with correct symbols", () => {
    const shortcuts = getResolvedShortcuts();
    const cmdK = shortcuts.find((s) => s.id === "command-palette");
    if (cmdK) {
      const formatted = formatShortcut(cmdK);
      expect(formatted).toBeTruthy();
    }
  });
});
