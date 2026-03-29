/**
 * E2E tests for the knowledge collections system.
 *
 * Tests cover:
 * - CRUD operations on knowledge collections
 * - Adding documents (by file and by URL)
 * - Removing documents
 * - Collection query (semantic search)
 * - Collection config updates
 * - Reindex trigger
 *
 * Prerequisite: `docker compose up -d` with a seeded database.
 * Run: API_BASE_URL=http://localhost:5173 bun test packages/api/tests/e2e/knowledge-collections.test.ts
 */
import { describe, it, expect, beforeAll } from "bun:test";

const API = process.env.API_BASE_URL ?? "http://localhost:5173";
const LOGIN_EMAIL = "admin@nova.local";
const LOGIN_PASSWORD = "Admin123!";

let cookie = "";
let orgId = "";

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { "Content-Type": "application/json", Cookie: cookie, "x-org-id": orgId, ...extra };
}

async function apiGet<T = any>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  return { status: res.status, body: (await res.json()) as T };
}

async function apiPost<T = any>(path: string, data: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  return { status: res.status, body: (await res.json()) as T };
}

async function apiPatch<T = any>(path: string, data: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(data),
  });
  return { status: res.status, body: (await res.json()) as T };
}

async function apiDelete<T = any>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  const body = res.status === 204 ? (null as T) : ((await res.json()) as T);
  return { status: res.status, body };
}

// ─── Auth ──────────────────────────────────────────
beforeAll(async () => {
  const loginRes = await fetch(`${API}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  expect(loginRes.ok).toBe(true);

  const cookies = loginRes.headers.getSetCookie?.() ?? [];
  cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  expect(cookie).toBeTruthy();

  const initRes = await fetch(`${API}/api/auth/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
  });
  expect(initRes.ok).toBe(true);
  const initBody = (await initRes.json()) as any;
  orgId = initBody.orgId;
  expect(orgId).toBeTruthy();
});

// ─── Helpers ───────────────────────────────────────
async function uploadFile(filename: string, content: string): Promise<string> {
  const buf = Buffer.from(content);
  const { body } = await apiPost<any>("/api/files/presign", {
    filename,
    contentType: "text/plain",
    size: buf.byteLength,
  });

  await fetch(body.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: buf,
  });

  await apiPost(`/api/files/${body.fileId}/confirm`, {});
  return body.fileId;
}

// ─── Tests ─────────────────────────────────────────

describe("Knowledge collections (e2e)", () => {
  let collectionId: string;

  it("creates a new knowledge collection", async () => {
    const { status, body } = await apiPost<any>("/api/knowledge", {
      name: "E2E Test Collection",
      description: "A test collection for e2e validation",
    });
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.name).toBe("E2E Test Collection");
    expect(body.status).toBe("active");
    collectionId = body.id;
  });

  it("lists collections", async () => {
    const { status, body } = await apiGet<any>("/api/knowledge");
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);

    const found = body.data.find((c: any) => c.id === collectionId);
    expect(found).toBeTruthy();
    expect(found.name).toBe("E2E Test Collection");
  });

  it("retrieves a single collection", async () => {
    const { status, body } = await apiGet<any>(`/api/knowledge/${collectionId}`);
    expect(status).toBe(200);
    expect(body.id).toBe(collectionId);
    expect(body.name).toBe("E2E Test Collection");
    expect(body.description).toBe("A test collection for e2e validation");
  });

  it("updates a collection name and description", async () => {
    const { status, body } = await apiPatch<any>(`/api/knowledge/${collectionId}`, {
      name: "Updated E2E Collection",
      description: "Updated description",
    });
    expect(status).toBe(200);
    expect(body.name).toBe("Updated E2E Collection");
  });

  it("adds a document by file upload", async () => {
    const fileId = await uploadFile(
      "knowledge-doc.txt",
      "This is a knowledge base document about quantum computing fundamentals.",
    );

    const { status, body } = await apiPost<any>(`/api/knowledge/${collectionId}/documents`, {
      fileId,
      title: "Quantum Computing Basics",
    });
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.title).toBe("Quantum Computing Basics");
    expect(body.status).toBe("pending");
    expect(body.fileId).toBe(fileId);
  });

  it("adds a document by URL", async () => {
    const { status, body } = await apiPost<any>(`/api/knowledge/${collectionId}/documents`, {
      sourceUrl: "https://example.com/test-article",
      title: "External Article",
    });
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.title).toBe("External Article");
    expect(body.sourceUrl).toBe("https://example.com/test-article");
  });

  it("lists documents in the collection", async () => {
    const { status, body } = await apiGet<any>(`/api/knowledge/${collectionId}/documents`);
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);

    const fileDoc = body.data.find((d: any) => d.title === "Quantum Computing Basics");
    expect(fileDoc).toBeTruthy();
    expect(fileDoc.fileId).toBeTruthy();

    const urlDoc = body.data.find((d: any) => d.title === "External Article");
    expect(urlDoc).toBeTruthy();
    expect(urlDoc.sourceUrl).toBe("https://example.com/test-article");
  });

  it("removes a document from the collection", async () => {
    // Get the URL document to remove
    const { body: listBody } = await apiGet<any>(`/api/knowledge/${collectionId}/documents`);
    const urlDoc = listBody.data.find((d: any) => d.title === "External Article");
    expect(urlDoc).toBeTruthy();

    const delRes = await fetch(`${API}/api/knowledge/${collectionId}/documents/${urlDoc.id}`, {
      method: "DELETE",
      headers: headers(),
    });
    expect([200, 204]).toContain(delRes.status);

    // Verify it no longer appears in the active document list
    const { body: afterBody } = await apiGet<any>(`/api/knowledge/${collectionId}/documents`);
    const stillPresent = afterBody.data.find((d: any) => d.id === urlDoc.id);
    expect(stillPresent).toBeUndefined();
  });

  it("updates collection config (chunk size and overlap)", async () => {
    const { status, body } = await apiPatch<any>(`/api/knowledge/${collectionId}/config`, {
      chunkSize: 1024,
      chunkOverlap: 128,
    });
    expect(status).toBe(200);
    expect(body.chunkSize).toBe(1024);
    expect(body.chunkOverlap).toBe(128);
  });

  it("triggers reindex on a collection", async () => {
    const { status } = await apiPost<any>(`/api/knowledge/${collectionId}/reindex`, {});
    expect(status).toBe(200);
  });

  it("queries the collection (may return empty if not indexed yet)", async () => {
    const { status, body } = await apiPost<any>(`/api/knowledge/${collectionId}/query`, {
      query: "quantum computing",
      topK: 5,
    });
    expect(status).toBe(200);
    // Results may be empty if documents haven't been indexed yet
    expect(body).toBeDefined();
  });

  it("retrieves collection history (audit log)", async () => {
    const { status, body } = await apiGet<any>(`/api/knowledge/${collectionId}/history`);
    expect(status).toBe(200);
    expect(body).toBeDefined();
  });

  it("deletes the collection", async () => {
    const delRes = await fetch(`${API}/api/knowledge/${collectionId}`, {
      method: "DELETE",
      headers: headers(),
    });
    expect([200, 204]).toContain(delRes.status);

    // Verify it's gone
    const { status: getStatus } = await apiGet<any>(`/api/knowledge/${collectionId}`);
    expect(getStatus).toBe(404);
  });

  it("returns 404 for non-existent collection", async () => {
    const { status } = await apiGet<any>("/api/knowledge/00000000-0000-0000-0000-000000000000");
    expect(status).toBe(404);
  });
});
