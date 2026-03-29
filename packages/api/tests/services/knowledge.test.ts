import { describe, it, expect, mock, beforeEach } from "bun:test";

// ─── Configurable mock state ──────────────────────
let mockUpdateReturning: any[] = [];
let mockSelectResult: any[] = [];
let mockDeleteReturning: any[] = [];

// Track calls for assertions
let updateSetArg: any = null;
let updateCalls = 0;

function resetMocks() {
  mockUpdateReturning = [];
  mockSelectResult = [];
  mockDeleteReturning = [];
  updateSetArg = null;
  updateCalls = 0;
}

// ─── Module mocks ─────────────────────────────────
mock.module("../../src/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(mockSelectResult),
        }),
        innerJoin: () => ({ where: () => Promise.resolve([]) }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: "doc-new" }]),
        onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }),
      }),
    }),
    update: () => ({
      set: (arg: any) => {
        updateCalls++;
        updateSetArg = arg;
        return {
          where: () => ({
            returning: () => Promise.resolve(updateCalls === 1 ? mockUpdateReturning : []),
          }),
        };
      },
    }),
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(mockDeleteReturning),
      }),
    }),
  },
}));

mock.module("../../src/lib/redis", () => ({
  redis: { get: () => null, set: () => null, del: () => null, ping: () => "PONG" },
}));

mock.module("../../src/lib/qdrant-sync", () => ({
  syncKnowledgeDocUpsert: () => {},
  syncKnowledgeDocDelete: () => {},
  syncKnowledgeChunksByDocumentDelete: () => {},
  syncKnowledgeChunksByCollectionDelete: () => {},
}));

mock.module("../../src/lib/qdrant", () => ({
  searchVector: () => Promise.resolve([]),
  COLLECTIONS: { KNOWLEDGE_DOCS: "nova_knowledge_docs", KNOWLEDGE_CHUNKS: "nova_knowledge_chunks" },
}));

mock.module("../../src/lib/temporal", () => ({
  getTemporalClient: () => Promise.resolve({ workflow: { start: () => Promise.resolve() } }),
}));

// Import service after mocks are set up
const { knowledgeService } = await import("../../src/services/knowledge.service");

// ─── Test data ────────────────────────────────────
const ORG_ID = "org-1";
const COLLECTION_ID = "col-1";

function makeDoc(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: "doc-1",
    knowledgeCollectionId: COLLECTION_ID,
    orgId: ORG_ID,
    title: "Test Document",
    status: "indexed",
    fileId: null,
    connectorId: null,
    externalId: null,
    sourceUrl: null,
    content: "test content",
    metadata: null,
    summary: null,
    errorMessage: null,
    tokenCount: 100,
    chunkCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────

describe("knowledgeService.removeDocument", () => {
  beforeEach(resetMocks);

  it("removes a document with status 'pending'", async () => {
    const doc = makeDoc({ id: "doc-pending", status: "pending" });
    mockUpdateReturning = [doc];

    const result = await knowledgeService.removeDocument(ORG_ID, "doc-pending");
    expect(result.id).toBe("doc-pending");
    expect(updateSetArg).toHaveProperty("deletedAt");
  });

  it("removes a document with status 'indexed'", async () => {
    const doc = makeDoc({ id: "doc-indexed", status: "indexed" });
    mockUpdateReturning = [doc];

    const result = await knowledgeService.removeDocument(ORG_ID, "doc-indexed");
    expect(result.id).toBe("doc-indexed");
  });

  it("removes a document with status 'failed'", async () => {
    const doc = makeDoc({ id: "doc-failed", status: "failed", errorMessage: "ingestion error" });
    mockUpdateReturning = [doc];

    const result = await knowledgeService.removeDocument(ORG_ID, "doc-failed");
    expect(result.id).toBe("doc-failed");
  });

  it("throws 404 for non-existent document", async () => {
    mockUpdateReturning = [];

    await expect(
      knowledgeService.removeDocument(ORG_ID, "doc-nonexistent"),
    ).rejects.toThrow("Not Found");
  });

  it("throws 404 for already-deleted document", async () => {
    // The WHERE clause includes isNull(deletedAt), so an already-deleted doc returns no rows
    mockUpdateReturning = [];

    await expect(
      knowledgeService.removeDocument(ORG_ID, "doc-already-deleted"),
    ).rejects.toThrow("Not Found");
  });

  it("soft-deletes associated chunks", async () => {
    const doc = makeDoc({ id: "doc-with-chunks" });
    mockUpdateReturning = [doc];

    await knowledgeService.removeDocument(ORG_ID, "doc-with-chunks");

    // The service calls db.update() twice: once for document, once for chunks
    expect(updateCalls).toBe(2);
  });
});

describe("knowledgeService.listDocuments", () => {
  beforeEach(resetMocks);

  it("returns only non-deleted documents", async () => {
    // The mock returns whatever mockSelectResult is set to.
    // In production, the SQL WHERE clause filters deletedAt IS NULL.
    // Here we verify the service calls db.select() and returns results.
    const activeDocs = [
      makeDoc({ id: "doc-1", deletedAt: null }),
      makeDoc({ id: "doc-2", deletedAt: null }),
    ];
    mockSelectResult = activeDocs;

    const result = await knowledgeService.listDocuments(ORG_ID, COLLECTION_ID);
    expect(result).toHaveLength(2);
    expect(result.every((d: any) => d.deletedAt === null)).toBe(true);
  });

  it("returns empty list when all documents are deleted", async () => {
    mockSelectResult = [];

    const result = await knowledgeService.listDocuments(ORG_ID, COLLECTION_ID);
    expect(result).toHaveLength(0);
  });
});
