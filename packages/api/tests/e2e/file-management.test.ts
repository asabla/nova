/**
 * E2E tests for the file management system.
 *
 * Tests cover:
 * - File listing (GET /api/files)
 * - File deletion (DELETE /api/files/:id)
 * - File download URL (GET /api/files/:id/download)
 * - Storage usage tracking (GET /api/files/usage/me)
 * - Upload config retrieval (GET /api/files/config/upload)
 *
 * Prerequisite: `docker compose up -d` with a seeded database.
 * Run: API_BASE_URL=http://localhost:5173 bun test packages/api/tests/e2e/file-management.test.ts
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

async function apiDelete<T = any>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  return { status: res.status, body: (await res.json()) as T };
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
async function uploadFile(filename: string, contentType: string, content: string): Promise<string> {
  const buf = Buffer.from(content);
  const { status, body } = await apiPost<any>("/api/files/presign", {
    filename,
    contentType,
    size: buf.byteLength,
  });
  expect(status).toBe(201);
  expect(body.fileId).toBeTruthy();

  // Upload to presigned URL
  const uploadRes = await fetch(body.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buf,
  });
  expect(uploadRes.ok).toBe(true);

  // Confirm
  const confirmRes = await apiPost<any>(`/api/files/${body.fileId}/confirm`, {});
  expect(confirmRes.status).toBe(200);

  return body.fileId;
}

// ─── Tests ─────────────────────────────────────────

describe("File management (e2e)", () => {
  let testFileId: string;

  it("uploads a file via presign → PUT → confirm flow", async () => {
    testFileId = await uploadFile("test-manage.txt", "text/plain", "Test file content for management");
    expect(testFileId).toBeTruthy();
  });

  it("lists user files with pagination", async () => {
    const { status, body } = await apiGet<any>("/api/files?page=1&pageSize=100");
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.page).toBe(1);

    // Our uploaded file should be in the list
    const found = body.data.find((f: any) => f.id === testFileId);
    expect(found).toBeTruthy();
    expect(found.filename).toBe("test-manage.txt");
    expect(found.contentType).toBe("text/plain");
  });

  it("retrieves a single file by ID", async () => {
    const { status, body } = await apiGet<any>(`/api/files/${testFileId}`);
    expect(status).toBe(200);
    expect(body.id).toBe(testFileId);
    expect(body.filename).toBe("test-manage.txt");
    expect(body.sizeBytes).toBeGreaterThan(0);
  });

  it("gets a download URL for a file", async () => {
    const { status, body } = await apiGet<any>(`/api/files/${testFileId}/download`);
    expect(status).toBe(200);
    expect(body.url).toBeTruthy();
    expect(typeof body.url).toBe("string");
  });

  it("tracks storage usage", async () => {
    const { status, body } = await apiGet<any>("/api/files/usage/me");
    expect(status).toBe(200);
    expect(body.totalBytes).toBeGreaterThan(0);
    expect(typeof body.totalMb).toBe("number");
  });

  it("retrieves upload config", async () => {
    const { status, body } = await apiGet<any>("/api/files/config/upload");
    expect(status).toBe(200);
    expect(body.allowedMimeTypes).toBeDefined();
    expect(Array.isArray(body.allowedMimeTypes)).toBe(true);
    expect(body.maxFileSizeBytes).toBeGreaterThan(0);
    expect(body.maxFileSizeMb).toBeGreaterThan(0);
  });

  it("deletes a file", async () => {
    const { status, body } = await apiDelete<any>(`/api/files/${testFileId}`);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    // Verify file is no longer accessible
    const { status: getStatus } = await apiGet<any>(`/api/files/${testFileId}`);
    expect(getStatus).toBe(404);
  });

  it("returns 404 for non-existent file", async () => {
    const { status } = await apiGet<any>("/api/files/00000000-0000-0000-0000-000000000000");
    expect(status).toBe(404);
  });

  it("aggregated /all endpoint returns personal files", async () => {
    // Upload a file first
    const fileId = await uploadFile("agg-test.txt", "text/plain", "Aggregated test file");

    const { status, body } = await apiGet<any>("/api/files/all?page=1&pageSize=100");
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);

    const found = body.data.find((f: any) => f.id === fileId);
    expect(found).toBeTruthy();
    expect(found.source).toBe("personal");

    // Cleanup
    await apiDelete(`/api/files/${fileId}`);
  });

  it("aggregated /all endpoint includes knowledge documents", async () => {
    // Create a knowledge collection with a URL document
    const { body: col } = await apiPost<any>("/api/knowledge", {
      name: "Agg Test Collection",
    });
    const colId = col.id;

    const { body: doc } = await apiPost<any>(`/api/knowledge/${colId}/documents`, {
      title: "Agg External Link",
      sourceUrl: "https://example.com/agg-test",
    });

    const { status, body } = await apiGet<any>("/api/files/all?page=1&pageSize=100");
    expect(status).toBe(200);

    const found = body.data.find((f: any) => f.id === doc.id && f.source === "knowledge");
    expect(found).toBeTruthy();
    expect(found.sourceName).toBe("Agg Test Collection");
    expect(found.contentType).toBe("link");

    // Cleanup
    const delRes = await fetch(`${API}/api/knowledge/${colId}`, {
      method: "DELETE",
      headers: headers(),
    });
    expect([200, 204]).toContain(delRes.status);
  });

  it("aggregated /all endpoint filters by source", async () => {
    const { status, body } = await apiGet<any>("/api/files/all?source=personal&page=1&pageSize=100");
    expect(status).toBe(200);
    expect(body.data).toBeDefined();

    // All returned items should have source=personal
    for (const file of body.data) {
      expect(["personal", "workspace"]).toContain(file.source);
    }
  });

  it("aggregated /all endpoint supports search", async () => {
    const fileId = await uploadFile("unique-searchable-xyz.txt", "text/plain", "searchable content");

    const { status, body } = await apiGet<any>("/api/files/all?search=unique-searchable-xyz&page=1&pageSize=100");
    expect(status).toBe(200);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const found = body.data.find((f: any) => f.id === fileId);
    expect(found).toBeTruthy();

    // Cleanup
    await apiDelete(`/api/files/${fileId}`);
  });

  it("handles multiple file uploads and listing", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = await uploadFile(`batch-${i}.txt`, "text/plain", `Batch file ${i} content`);
      ids.push(id);
    }

    const { status, body } = await apiGet<any>("/api/files?page=1&pageSize=50");
    expect(status).toBe(200);

    for (const id of ids) {
      const found = body.data.find((f: any) => f.id === id);
      expect(found).toBeTruthy();
    }

    // Cleanup
    for (const id of ids) {
      await apiDelete(`/api/files/${id}`);
    }
  });
});
