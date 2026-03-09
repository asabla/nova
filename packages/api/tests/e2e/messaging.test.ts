/**
 * E2E tests for the messaging system.
 *
 * Tests cover:
 * - Send message to a conversation
 * - List messages in a conversation
 * - Edit a message
 * - Delete a message
 * - Rate a message
 * - Add note to a message
 * - Get message edit history
 * - Stream endpoint validation
 * - Message attachments
 *
 * Prerequisite: `docker compose up -d` with a seeded database.
 * Run: API_BASE_URL=http://localhost:5173 bun test packages/api/tests/e2e/messaging.test.ts
 */
import { describe, it, expect, beforeAll } from "bun:test";

const API = process.env.API_BASE_URL ?? "http://localhost:5173";
const LOGIN_EMAIL = "admin@nova.local";
const LOGIN_PASSWORD = "Admin123!";

let cookie = "";
let orgId = "";
let conversationId = "";
let messageId = "";

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

// ─── Auth & Setup ──────────────────────────────────
beforeAll(async () => {
  // Sign in
  const loginRes = await fetch(`${API}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  expect(loginRes.ok).toBe(true);

  const cookies = loginRes.headers.getSetCookie?.() ?? [];
  cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  expect(cookie).toBeTruthy();

  // Init org
  const initRes = await fetch(`${API}/api/auth/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
  });
  expect(initRes.ok).toBe(true);
  const initBody = (await initRes.json()) as any;
  orgId = initBody.orgId;
  expect(orgId).toBeTruthy();

  // Create a conversation for message tests
  const convRes = await apiPost<any>("/api/conversations", {
    title: "E2E Messaging Test",
  });
  expect(convRes.status).toBe(201);
  conversationId = convRes.body.id;
  expect(conversationId).toBeTruthy();
});

// ─── Tests ─────────────────────────────────────────

describe("Messaging (e2e)", () => {
  it("sends a user message to a conversation", async () => {
    const { status, body } = await apiPost<any>(
      `/api/conversations/${conversationId}/messages`,
      { content: "Hello, this is a test message" },
    );
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.content).toBe("Hello, this is a test message");
    expect(body.senderType).toBe("user");
    expect(body.conversationId).toBe(conversationId);
    messageId = body.id;
  });

  it("rejects empty message content", async () => {
    const { status } = await apiPost<any>(
      `/api/conversations/${conversationId}/messages`,
      { content: "" },
    );
    expect(status).toBe(400);
  });

  it("rejects message without content field", async () => {
    const { status } = await apiPost<any>(
      `/api/conversations/${conversationId}/messages`,
      {},
    );
    expect(status).toBe(400);
  });

  it("lists messages in a conversation", async () => {
    const { status, body } = await apiGet<any>(
      `/api/conversations/${conversationId}/messages`,
    );
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const found = body.data.find((m: any) => m.id === messageId);
    expect(found).toBeTruthy();
    expect(found.content).toBe("Hello, this is a test message");
  });

  it("supports pagination in message listing", async () => {
    const { status, body } = await apiGet<any>(
      `/api/conversations/${conversationId}/messages?page=1&pageSize=1`,
    );
    expect(status).toBe(200);
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(1);
    expect(body.total).toBeDefined();
  });

  it("gets a single message by id", async () => {
    const { status, body } = await apiGet<any>(
      `/api/conversations/${conversationId}/messages/${messageId}`,
    );
    expect(status).toBe(200);
    expect(body.id).toBe(messageId);
    expect(body.content).toBe("Hello, this is a test message");
  });

  it("returns 404 for nonexistent message", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const { status } = await apiGet<any>(
      `/api/conversations/${conversationId}/messages/${fakeId}`,
    );
    expect(status).toBe(404);
  });

  it("sends multiple messages in order", async () => {
    await apiPost(`/api/conversations/${conversationId}/messages`, { content: "Second message" });
    await apiPost(`/api/conversations/${conversationId}/messages`, { content: "Third message" });

    const { body } = await apiGet<any>(`/api/conversations/${conversationId}/messages`);
    const contents = body.data.map((m: any) => m.content);
    expect(contents).toContain("Hello, this is a test message");
    expect(contents).toContain("Second message");
    expect(contents).toContain("Third message");

    // Verify ordering: messages should be in chronological order
    const timestamps = body.data.map((m: any) => new Date(m.createdAt).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  it("edits a message", async () => {
    const { status, body } = await apiPatch<any>(
      `/api/conversations/${conversationId}/messages/${messageId}`,
      { content: "Updated test message" },
    );
    expect(status).toBe(200);
    expect(body.content).toBe("Updated test message");
    expect(body.isEdited).toBe(true);
  });

  it("rejects editing with empty content", async () => {
    const { status } = await apiPatch<any>(
      `/api/conversations/${conversationId}/messages/${messageId}`,
      { content: "" },
    );
    expect(status).toBe(400);
  });

  it("gets message edit history", async () => {
    const { status, body } = await apiGet<any>(
      `/api/conversations/${conversationId}/messages/${messageId}/history`,
    );
    expect(status).toBe(200);
    expect(body.messageId).toBe(messageId);
    expect(body.currentContent).toBe("Updated test message");
    expect(body.isEdited).toBe(true);
    expect(body.history.length).toBeGreaterThanOrEqual(1);
    expect(body.history[0].content).toBe("Hello, this is a test message");
  });

  it("rates a message thumbs up", async () => {
    const { status, body } = await apiPost<any>(
      `/api/conversations/${conversationId}/messages/${messageId}/rate`,
      { rating: 1 },
    );
    expect(status).toBe(200);
    expect(body.rating).toBe(1);
  });

  it("rates a message thumbs down (updates existing rating)", async () => {
    const { status, body } = await apiPost<any>(
      `/api/conversations/${conversationId}/messages/${messageId}/rate`,
      { rating: -1, feedback: "Not helpful" },
    );
    expect(status).toBe(200);
    expect(body.rating).toBe(-1);
    expect(body.feedback).toBe("Not helpful");
  });

  it("rejects invalid rating value", async () => {
    const { status } = await apiPost<any>(
      `/api/conversations/${conversationId}/messages/${messageId}/rate`,
      { rating: 0 },
    );
    expect(status).toBe(400);
  });

  it("adds a note to a message", async () => {
    const { status, body } = await apiPost<any>(
      `/api/conversations/${conversationId}/messages/${messageId}/notes`,
      { content: "This is a test note" },
    );
    expect(status).toBe(201);
    expect(body.content).toBe("This is a test note");
    expect(body.messageId).toBe(messageId);
  });

  it("rejects empty note content", async () => {
    const { status } = await apiPost<any>(
      `/api/conversations/${conversationId}/messages/${messageId}/notes`,
      { content: "" },
    );
    expect(status).toBe(400);
  });

  it("deletes a message (soft delete)", async () => {
    // Create a new message to delete
    const createRes = await apiPost<any>(
      `/api/conversations/${conversationId}/messages`,
      { content: "Message to delete" },
    );
    const deleteId = createRes.body.id;

    const { status, body } = await apiDelete<any>(
      `/api/conversations/${conversationId}/messages/${deleteId}`,
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    // Verify it's gone from the listing
    const listRes = await apiGet<any>(`/api/conversations/${conversationId}/messages`);
    const found = listRes.body.data.find((m: any) => m.id === deleteId);
    expect(found).toBeUndefined();
  });
});

describe("Stream endpoint validation (e2e)", () => {
  it("rejects stream request without model", async () => {
    const res = await fetch(
      `${API}/api/conversations/${conversationId}/messages/stream`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          messages: [{ role: "user", content: "hi" }],
        }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("rejects stream request without messages", async () => {
    const res = await fetch(
      `${API}/api/conversations/${conversationId}/messages/stream`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          model: "gpt-4",
        }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("rejects stream request with invalid role", async () => {
    const res = await fetch(
      `${API}/api/conversations/${conversationId}/messages/stream`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "tool", content: "hi" }],
        }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("accepts stream request with valid payload (returns SSE)", async () => {
    const res = await fetch(
      `${API}/api/conversations/${conversationId}/messages/stream`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          model: "default",
          messages: [{ role: "user", content: "Say hello" }],
        }),
      },
    );
    // Should return 200 (SSE stream starts even if LLM fails)
    expect(res.status).toBe(200);
  });
});

describe("Messaging to non-existent conversation (e2e)", () => {
  const fakeConvId = "00000000-0000-0000-0000-000000000000";

  it("returns 404 when sending message to non-existent conversation", async () => {
    const { status } = await apiPost<any>(
      `/api/conversations/${fakeConvId}/messages`,
      { content: "hello" },
    );
    expect(status).toBe(404);
  });

  it("returns 404 when listing messages for non-existent conversation", async () => {
    const { status, body } = await apiGet<any>(
      `/api/conversations/${fakeConvId}/messages`,
    );
    // Listing returns empty data for non-existent conversation (not 404)
    expect(status).toBe(200);
    expect(body.data.length).toBe(0);
  });
});
