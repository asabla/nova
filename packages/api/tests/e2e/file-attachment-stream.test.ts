/**
 * E2E tests for the file attachment → LLM streaming pipeline.
 *
 * These tests run against the live Docker services (API, MinIO, Postgres, LiteLLM).
 * Prerequisite: `docker compose up -d` with a seeded database.
 *
 * Run:  API_BASE_URL=http://localhost:5173 bun test packages/api/tests/e2e/file-attachment-stream.test.ts
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

// ─── Auth ──────────────────────────────────────────
beforeAll(async () => {
  // 1. Sign in
  const loginRes = await fetch(`${API}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  expect(loginRes.ok).toBe(true);

  const cookies = loginRes.headers.getSetCookie?.() ?? [];
  cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  expect(cookie).toBeTruthy();

  // 2. Initialize org (sets active org, returns orgId)
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
async function createConversation(title: string) {
  const { status, body } = await apiPost<any>("/api/conversations", { title });
  expect(status).toBe(201);
  expect(body.id).toBeTruthy();
  return body;
}

async function presignUpload(filename: string, contentType: string, size: number) {
  const { status, body } = await apiPost<any>("/api/files/presign", { filename, contentType, size });
  expect(status).toBe(201);
  expect(body.fileId).toBeTruthy();
  expect(body.uploadUrl).toBeTruthy();
  return body as { fileId: string; uploadUrl: string };
}

async function uploadToPresignedUrl(url: string, content: Buffer | Uint8Array, contentType: string) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: content,
  });
  expect(res.ok).toBe(true);
}

async function confirmUpload(fileId: string) {
  const { status } = await apiPost<any>(`/api/files/${fileId}/confirm`, {});
  expect(status).toBe(200);
}

async function sendMessage(
  conversationId: string,
  content: string,
  attachments?: { fileId: string; attachmentType: string }[],
) {
  const { status, body } = await apiPost<any>(
    `/api/conversations/${conversationId}/messages`,
    { content, senderType: "user", ...(attachments?.length ? { attachments } : {}) },
  );
  expect(status).toBe(201);
  return body;
}

async function getMessages(conversationId: string) {
  const { status, body } = await apiGet<any>(
    `/api/conversations/${conversationId}/messages?page=1&pageSize=100`,
  );
  expect(status).toBe(200);
  return body;
}

/**
 * Initiate a stream and collect all SSE events.
 * Returns events, concatenated content, and any error.
 */
async function streamMessage(
  conversationId: string,
  llmMessages: { role: string; content: string }[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<{ events: { event: string; data: any }[]; content: string; error: any | null }> {
  const res = await fetch(
    `${API}/api/conversations/${conversationId}/messages/stream`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        content: llmMessages[llmMessages.length - 1]?.content ?? "",
        messages: llmMessages,
        model: opts.model ?? "default",
        temperature: opts.temperature ?? 0.3,
        maxTokens: opts.maxTokens ?? 512,
        enableTools: false,
      }),
    },
  );

  expect(res.ok).toBe(true);

  const events: { event: string; data: any }[] = [];
  let content = "";
  let error: any | null = null;

  const text = await res.text();
  for (const line of text.split("\n")) {
    if (line.startsWith("event: ")) {
      events.push({ event: line.slice(7).trim(), data: null });
    } else if (line.startsWith("data: ")) {
      const dataStr = line.slice(6).trim();
      if (events.length > 0) {
        try {
          events[events.length - 1].data = JSON.parse(dataStr);
        } catch {
          events[events.length - 1].data = dataStr;
        }
      }
      const last = events[events.length - 1];
      if (last?.event === "token" && last.data?.content) {
        content += last.data.content;
      }
      if (last?.event === "error") {
        error = last.data;
      }
    }
  }

  return { events, content, error };
}

// ─── Upload + attach helper ────────────────────────
async function uploadAndAttach(
  filename: string,
  contentType: string,
  fileContent: string | Buffer,
): Promise<string> {
  const buf = typeof fileContent === "string" ? Buffer.from(fileContent) : fileContent;
  const { fileId, uploadUrl } = await presignUpload(filename, contentType, buf.byteLength);
  await uploadToPresignedUrl(uploadUrl, buf, contentType);
  await confirmUpload(fileId);
  return fileId;
}

/**
 * Build a minimal valid PDF containing the given text.
 * Uses raw PDF syntax — no external lib needed.
 */
function buildMinimalPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 100 700 Td (${text}) Tj ET`;
  const streamBytes = Buffer.from(stream);
  const lines = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${streamBytes.length} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "xref",
    "0 6",
    "0000000000 65535 f ",
    "0000000009 00000 n ",
    "0000000058 00000 n ",
    "0000000115 00000 n ",
    `0000000${(266).toString().padStart(3, "0")} 00000 n `,
    `0000000${(266 + 50 + streamBytes.length).toString().padStart(3, "0")} 00000 n `,
    "trailer << /Size 6 /Root 1 0 R >>",
    "startxref",
    "0",
    "%%EOF",
  ];
  return Buffer.from(lines.join("\n"));
}

// ─── Tests ─────────────────────────────────────────

describe("File attachment → LLM streaming pipeline (e2e)", () => {
  it("presign → upload → confirm → attach creates visible attachment on message", async () => {
    const conv = await createConversation("e2e-attach-test");

    const fileId = await uploadAndAttach(
      "test-note.txt",
      "text/plain",
      "The secret code is PINEAPPLE.",
    );

    await sendMessage(conv.id, "check this file", [{ fileId, attachmentType: "file" }]);

    const msgData = await getMessages(conv.id);
    const msgs = msgData.data ?? msgData;
    const userMsg = msgs.find((m: any) => m.senderType === "user");

    expect(userMsg).toBeTruthy();
    expect(userMsg.attachments).toBeDefined();
    expect(userMsg.attachments.length).toBe(1);
    expect(userMsg.attachments[0].fileId).toBe(fileId);
    expect(userMsg.attachments[0].filename).toBe("test-note.txt");
  });

  it("attachment metadata includes filename, contentType, sizeBytes", async () => {
    const conv = await createConversation("e2e-metadata-test");
    const payload = "Hello, metadata test content.";

    const fileId = await uploadAndAttach("meta.txt", "text/plain", payload);
    await sendMessage(conv.id, "metadata test", [{ fileId, attachmentType: "file" }]);

    const msgData = await getMessages(conv.id);
    const msgs = msgData.data ?? msgData;
    const att = msgs.find((m: any) => m.senderType === "user")?.attachments?.[0];

    expect(att).toBeTruthy();
    expect(att.filename).toBe("meta.txt");
    expect(att.contentType).toBe("text/plain");
    expect(att.sizeBytes).toBeGreaterThan(0);
  });

  it("stream enriches user messages with text file content (LLM sees the file)", async () => {
    const conv = await createConversation("e2e-enrichment-test");

    const secretContent = "Project AURORA: budget is $42,000, deadline March 15th.";
    const fileId = await uploadAndAttach("project-info.txt", "text/plain", secretContent);

    await sendMessage(conv.id, "summarize the file", [{ fileId, attachmentType: "file" }]);

    // Stream a response — LLM should reference file content
    const result = await streamMessage(conv.id, [
      { role: "user", content: "summarize the file" },
    ]);

    expect(result.error).toBeNull();
    expect(result.content.length).toBeGreaterThan(0);

    // Check we got token events and a done event
    const tokenEvents = result.events.filter((e) => e.event === "token");
    expect(tokenEvents.length).toBeGreaterThan(0);
    const doneEvents = result.events.filter((e) => e.event === "done");
    expect(doneEvents.length).toBe(1);
  }, 60_000);

  it("stream works without attachments (no regression)", async () => {
    const conv = await createConversation("e2e-no-attach-test");

    await sendMessage(conv.id, "say hello");

    const result = await streamMessage(conv.id, [
      { role: "user", content: "say hello" },
    ]);

    expect(result.error).toBeNull();
    expect(result.content.length).toBeGreaterThan(0);
  }, 60_000);

  it("file download endpoint returns a valid presigned URL", async () => {
    const fileId = await uploadAndAttach("dl-test.txt", "text/plain", "download me");

    const { status, body } = await apiGet<any>(`/api/files/${fileId}/download`);
    expect(status).toBe(200);
    expect(body.url).toBeTruthy();
    expect(typeof body.url).toBe("string");
  });

  it("stream references file content (LLM mentions specific details from file)", async () => {
    const conv = await createConversation("e2e-content-check-test");

    // Use a very specific, unusual string the LLM wouldn't guess
    const fileId = await uploadAndAttach(
      "secret.txt",
      "text/plain",
      "The access code for vault 7 is ZEPHYR-9182.",
    );

    await sendMessage(conv.id, "What is the access code in the file?", [
      { fileId, attachmentType: "file" },
    ]);

    const result = await streamMessage(conv.id, [
      { role: "user", content: "What is the access code in the file?" },
    ]);

    expect(result.error).toBeNull();
    expect(result.content.length).toBeGreaterThan(0);

    // The LLM should mention the specific code from the file
    const lower = result.content.toLowerCase();
    const mentionsCode = lower.includes("zephyr") || lower.includes("9182");
    expect(mentionsCode).toBe(true);
  }, 60_000);

  it("PDF file content is extracted and visible to LLM", async () => {
    const conv = await createConversation("e2e-pdf-extract-test");

    const pdfBuf = buildMinimalPdf("Project FALCON budget is 99000 dollars");
    const fileId = await uploadAndAttach("report.pdf", "application/pdf", pdfBuf);

    await sendMessage(conv.id, "What is the project budget in the PDF?", [
      { fileId, attachmentType: "file" },
    ]);

    const result = await streamMessage(conv.id, [
      { role: "user", content: "What is the project budget in the PDF?" },
    ]);

    expect(result.error).toBeNull();
    expect(result.content.length).toBeGreaterThan(0);

    // The LLM should mention details from the PDF
    const lower = result.content.toLowerCase();
    const mentionsBudget = lower.includes("99000") || lower.includes("99,000") || lower.includes("falcon");
    expect(mentionsBudget).toBe(true);
  }, 60_000);
});
