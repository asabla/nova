import { describe, it, expect, beforeEach } from "bun:test";

// Mock localStorage for tests
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (index: number) => [...store.keys()][index] ?? null,
};

// @ts-ignore
globalThis.localStorage = mockLocalStorage;
// @ts-ignore - crypto.randomUUID polyfill for test env
globalThis.crypto = { randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` } as any;

// Import after mocks
const { saveDraft, loadDraft, clearDraft, queuePendingMessage, loadPendingMessages, removePendingMessage } = await import("../../src/lib/ws-client");

describe("Message Draft Preservation", () => {
  beforeEach(() => {
    store.clear();
  });

  it("saves and loads a draft", () => {
    saveDraft("conv-1", "Hello world");
    expect(loadDraft("conv-1")).toBe("Hello world");
  });

  it("returns empty string for missing draft", () => {
    expect(loadDraft("nonexistent")).toBe("");
  });

  it("clears a draft", () => {
    saveDraft("conv-1", "test");
    clearDraft("conv-1");
    expect(loadDraft("conv-1")).toBe("");
  });

  it("removes draft when saving empty text", () => {
    saveDraft("conv-1", "test");
    saveDraft("conv-1", "");
    expect(loadDraft("conv-1")).toBe("");
  });

  it("handles multiple conversations independently", () => {
    saveDraft("conv-1", "draft 1");
    saveDraft("conv-2", "draft 2");
    expect(loadDraft("conv-1")).toBe("draft 1");
    expect(loadDraft("conv-2")).toBe("draft 2");
  });
});

describe("Pending Message Queue", () => {
  beforeEach(() => {
    store.clear();
  });

  it("queues and loads pending messages", () => {
    queuePendingMessage("conv-1", "Hello");
    const pending = loadPendingMessages();
    expect(pending).toHaveLength(1);
    expect(pending[0].content).toBe("Hello");
    expect(pending[0].conversationId).toBe("conv-1");
  });

  it("removes a pending message by id", () => {
    const id = queuePendingMessage("conv-1", "test");
    expect(loadPendingMessages()).toHaveLength(1);
    removePendingMessage(id);
    expect(loadPendingMessages()).toHaveLength(0);
  });

  it("handles multiple pending messages", () => {
    queuePendingMessage("conv-1", "msg1");
    queuePendingMessage("conv-1", "msg2");
    queuePendingMessage("conv-2", "msg3");
    expect(loadPendingMessages()).toHaveLength(3);
  });
});
