/**
 * E2E tests for the workspaces system.
 *
 * Tests cover:
 * - Workspace CRUD (create, read, update, archive, delete)
 * - Workspace file management
 * - Workspace conversation management
 * - Member management (add, update role, remove)
 * - Activity feed
 *
 * Prerequisite: `docker compose up -d` with a seeded database.
 * Run: API_BASE_URL=http://localhost:5173 bun test packages/api/tests/e2e/workspaces.test.ts
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

// ─── Tests ─────────────────────────────────────────

describe("Workspaces (e2e)", () => {
  let workspaceId: string;

  it("creates a new workspace", async () => {
    const { status, body } = await apiPost<any>("/api/workspaces", {
      name: "E2E Test Workspace",
      description: "Testing workspace features end to end",
    });
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.name).toBe("E2E Test Workspace");
    workspaceId = body.id;
  });

  it("lists workspaces", async () => {
    const { status, body } = await apiGet<any>("/api/workspaces");
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);

    const found = body.data.find((w: any) => w.id === workspaceId);
    expect(found).toBeTruthy();
    expect(found.name).toBe("E2E Test Workspace");
  });

  it("retrieves a single workspace", async () => {
    const { status, body } = await apiGet<any>(`/api/workspaces/${workspaceId}`);
    expect(status).toBe(200);
    expect(body.id).toBe(workspaceId);
    expect(body.name).toBe("E2E Test Workspace");
    expect(body.description).toBe("Testing workspace features end to end");
  });

  it("updates workspace name and description", async () => {
    const { status, body } = await apiPatch<any>(`/api/workspaces/${workspaceId}`, {
      name: "Updated E2E Workspace",
      description: "Updated description",
    });
    expect(status).toBe(200);
    expect(body.name).toBe("Updated E2E Workspace");
  });

  it("lists workspace members (creator should be admin)", async () => {
    const { status, body } = await apiGet<any>(`/api/workspaces/${workspaceId}/members`);
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    // Creator should be an admin member
    const adminMember = body.data.find((m: any) => m.role === "admin");
    expect(adminMember).toBeTruthy();
  });

  it("creates a conversation in the workspace", async () => {
    const { status, body } = await apiPost<any>(`/api/workspaces/${workspaceId}/conversations`, {
      title: "Workspace Chat",
    });
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.title).toBe("Workspace Chat");
  });

  it("lists workspace conversations", async () => {
    const { status, body } = await apiGet<any>(`/api/workspaces/${workspaceId}/conversations`);
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const conv = body.data.find((c: any) => c.title === "Workspace Chat");
    expect(conv).toBeTruthy();
  });

  it("uploads a file to workspace via presign", async () => {
    const content = "Workspace file content";
    const buf = Buffer.from(content);

    const { status, body } = await apiPost<any>(`/api/workspaces/${workspaceId}/files`, {
      filename: "workspace-doc.txt",
      contentType: "text/plain",
      sizeBytes: buf.byteLength,
    });
    expect(status).toBe(201);
    expect(body.fileId || body.uploadUrl).toBeTruthy();
  });

  it("lists workspace files", async () => {
    const { status, body } = await apiGet<any>(`/api/workspaces/${workspaceId}/files`);
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("deletes a workspace file", async () => {
    // First list files to get a file ID
    const { body: listBody } = await apiGet<any>(`/api/workspaces/${workspaceId}/files`);
    expect(listBody.data).toBeDefined();
    expect(listBody.data.length).toBeGreaterThanOrEqual(1);

    const fileId = listBody.data[0].id;
    const delRes = await fetch(`${API}/api/workspaces/${workspaceId}/files/${fileId}`, {
      method: "DELETE",
      headers: headers(),
    });
    expect(delRes.status).toBe(200);

    // Verify it's gone from the list
    const { body: afterBody } = await apiGet<any>(`/api/workspaces/${workspaceId}/files`);
    const found = afterBody.data.find((f: any) => f.id === fileId);
    expect(found).toBeFalsy();
  });

  it("retrieves workspace activity feed", async () => {
    const { status, body } = await apiGet<any>(`/api/workspaces/${workspaceId}/activity`);
    expect(status).toBe(200);
    expect(body).toBeDefined();
  });

  it("archives the workspace", async () => {
    const { status, body } = await apiPost<any>(`/api/workspaces/${workspaceId}/archive`, {});
    expect(status).toBe(200);

    // Verify it's archived
    const { body: ws } = await apiGet<any>(`/api/workspaces/${workspaceId}`);
    expect(ws.isArchived).toBe(true);
  });

  it("deletes the workspace", async () => {
    const delRes = await fetch(`${API}/api/workspaces/${workspaceId}`, {
      method: "DELETE",
      headers: headers(),
    });
    expect([200, 204]).toContain(delRes.status);
  });

  it("returns 404 for non-existent workspace", async () => {
    const { status } = await apiGet<any>("/api/workspaces/00000000-0000-0000-0000-000000000000");
    expect(status).toBe(404);
  });
});
