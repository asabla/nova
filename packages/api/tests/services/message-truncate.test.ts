import { describe, it, expect, mock, beforeEach } from "bun:test";

/**
 * Tests for message.service.deleteMessagesAfter — the core primitive behind
 * rerun/edit-and-rerun: soft-delete every message whose createdAt is strictly
 * greater than a given anchor message's createdAt.
 */

// Capture every db call made during a test run
type DbCall =
  | { op: "select"; table: "messages"; where?: unknown }
  | { op: "update"; table: "messages"; set: unknown; where?: unknown };

const dbCalls: DbCall[] = [];
// What the next `.from(messages).where(...)` select returns
let nextSelectResult: Array<{ createdAt: Date }> = [];
// What the next update's `.returning()` returns
let nextUpdateReturning: Array<{ id: string }> = [];

beforeEach(() => {
  dbCalls.length = 0;
  nextSelectResult = [];
  nextUpdateReturning = [];
});

mock.module("../../src/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (w: unknown) => {
          dbCalls.push({ op: "select", table: "messages", where: w });
          return Promise.resolve(nextSelectResult);
        },
      }),
    }),
    update: () => ({
      set: (s: unknown) => ({
        where: (w: unknown) => {
          dbCalls.push({ op: "update", table: "messages", set: s, where: w });
          return {
            returning: () => Promise.resolve(nextUpdateReturning),
          };
        },
      }),
    }),
  },
}));

mock.module("../../src/lib/qdrant-sync", () => ({
  syncConversationUpsert: () => {},
  syncConversationDelete: () => {},
  syncMessageUpsert: () => {},
  syncMessageDelete: () => {},
  syncAgentUpsert: () => {},
  syncAgentDelete: () => {},
  syncKnowledgeDocUpsert: () => {},
  syncKnowledgeDocDelete: () => {},
  syncKnowledgeChunksByDocumentDelete: () => {},
  syncKnowledgeChunksByCollectionDelete: () => {},
  syncFileUpsert: () => {},
  syncFileDelete: () => {},
}));

mock.module("../../src/lib/temporal", () => ({
  getTemporalClient: async () => ({ workflow: { start: async () => ({}) } }),
}));

describe("deleteMessagesAfter", () => {
  it("returns 0 and performs no update when the target message is not found", async () => {
    const { deleteMessagesAfter } = await import("../../src/services/message.service");
    nextSelectResult = []; // target not found

    const count = await deleteMessagesAfter("org-1", "conv-1", "missing-id");

    expect(count).toBe(0);
    const updates = dbCalls.filter((c) => c.op === "update");
    expect(updates).toHaveLength(0);
  });

  it("issues a soft-delete update setting deletedAt when target exists", async () => {
    const { deleteMessagesAfter } = await import("../../src/services/message.service");
    nextSelectResult = [{ createdAt: new Date("2025-01-01T00:00:00Z") }];
    nextUpdateReturning = [{ id: "m2" }, { id: "m3" }];

    const count = await deleteMessagesAfter("org-1", "conv-1", "anchor-id");

    expect(count).toBe(2);
    const updates = dbCalls.filter((c) => c.op === "update");
    expect(updates).toHaveLength(1);
    const set = updates[0]!.set as { deletedAt: Date };
    expect(set.deletedAt).toBeInstanceOf(Date);
  });

  it("returns the number of rows deleted (0 when anchor is the newest message)", async () => {
    const { deleteMessagesAfter } = await import("../../src/services/message.service");
    nextSelectResult = [{ createdAt: new Date("2025-01-01T00:00:00Z") }];
    nextUpdateReturning = []; // no messages after anchor

    const count = await deleteMessagesAfter("org-1", "conv-1", "anchor-id");
    expect(count).toBe(0);
  });

  it("queries for the anchor's createdAt before performing the delete", async () => {
    const { deleteMessagesAfter } = await import("../../src/services/message.service");
    nextSelectResult = [{ createdAt: new Date("2025-01-01T00:00:00Z") }];
    nextUpdateReturning = [{ id: "m2" }];

    await deleteMessagesAfter("org-1", "conv-1", "anchor-id");

    // select happens before update
    const ops = dbCalls.map((c) => c.op);
    expect(ops).toEqual(["select", "update"]);
  });
});
