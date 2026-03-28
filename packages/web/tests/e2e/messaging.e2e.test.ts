/**
 * E2E tests for the messaging/chat web UI flow.
 *
 * Tests the full user journey:
 * - Create a new conversation from the home page
 * - Send a message in the conversation
 * - Verify message appears in the chat
 * - Edit a message
 * - Send a follow-up message
 * - Verify message order
 *
 * Prerequisite: App running at http://localhost:5173 with a seeded database.
 * Run: npx playwright test packages/web/tests/e2e/messaging.e2e.test.ts
 */
import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const LOGIN_EMAIL = "admin@nova.local";
const LOGIN_PASSWORD = "Admin123!";

/** Helper: log in and navigate to the home page */
async function loginAndGoHome(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole("button", { name: "Sign in to NOVA" })).toBeVisible();
  await page.getByRole("textbox", { name: "Email" }).fill(LOGIN_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in to NOVA" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
}

/** Helper: wait for streaming to finish — either the send button appears,
 *  or we stop it manually if it takes too long */
async function ensureNotStreaming(page: Page) {
  const sendButton = page.getByRole("button", { name: "Send message" });
  const stopButton = page.getByRole("button", { name: "Stop streaming" });

  // Wait up to 20s, clicking stop whenever we see it
  for (let i = 0; i < 20; i++) {
    if (await sendButton.isVisible().catch(() => false)) {
      // Double-check: wait a beat and verify it's still there (not a brief flash)
      await page.waitForTimeout(500);
      if (await sendButton.isVisible().catch(() => false)) {
        return;
      }
    }
    // Click stop if visible
    if (await stopButton.isVisible().catch(() => false)) {
      await stopButton.click();
    }
    await page.waitForTimeout(1000);
  }

  // Final check
  await expect(sendButton).toBeVisible({ timeout: 5_000 });
}

/** Helper: create a new conversation by sending a message from the home page,
 *  then wait for streaming to finish so the send button is available. */
async function createConversation(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle");

  // The home page has a textarea for starting a new conversation
  const homeInput = page.getByPlaceholder("Ask anything...");
  await expect(homeInput).toBeVisible({ timeout: 10_000 });

  // Type an initial message and send to create the conversation
  await homeInput.fill("E2E test init");

  // Click the send button and wait for navigation to the conversation page
  await page.getByRole("button", { name: /send/i }).click();

  // Wait for redirect through /conversations/new to /conversations/:uuid
  await page.waitForURL(/\/conversations\/[0-9a-f]{8}-/, { timeout: 20_000 });

  // Wait for the message input in the conversation page to appear
  await expect(page.getByLabel("Message input")).toBeVisible({ timeout: 10_000 });

  // Wait for agent streaming to finish (or stop it)
  await ensureNotStreaming(page);
}

/** Helper: send a message in an existing conversation and wait for the POST */
async function sendMessage(page: Page, text: string) {
  const input = page.getByLabel("Message input");
  await input.fill(text);

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled({ timeout: 5_000 });

  const [msgResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/messages") && res.request().method() === "POST" && !res.url().includes("/stream"),
      { timeout: 15_000 },
    ),
    sendButton.click(),
  ]);

  return msgResponse;
}

test.describe("Messaging", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoHome(page);
  });

  test("can create a conversation and send a message", async ({ page }) => {
    await createConversation(page);

    const msgResponse = await sendMessage(page, "Hello from E2E test!");
    expect(msgResponse.status()).toBe(201);

    // Verify the message appears in the chat
    await expect(page.getByText("Hello from E2E test!")).toBeVisible({ timeout: 10_000 });
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    await createConversation(page);

    const input = page.getByLabel("Message input");
    await expect(input).toBeVisible();

    // Send button should be disabled when empty
    const sendButton = page.getByRole("button", { name: "Send message" });
    await expect(sendButton).toBeDisabled();

    // Type something — should become enabled
    await input.fill("test");
    await expect(sendButton).toBeEnabled();

    // Clear — should become disabled again
    await input.fill("");
    await expect(sendButton).toBeDisabled();
  });

  test("can send message with Enter key", async ({ page }) => {
    await createConversation(page);

    const input = page.getByLabel("Message input");
    await input.fill("Enter key test");
    await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled({ timeout: 5_000 });

    const [msgResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/messages") && res.request().method() === "POST" && !res.url().includes("/stream"),
        { timeout: 15_000 },
      ),
      input.press("Enter"),
    ]);
    expect(msgResponse.status()).toBe(201);

    await expect(page.getByText("Enter key test")).toBeVisible({ timeout: 10_000 });
  });

  test("Shift+Enter creates new line instead of sending", async ({ page }) => {
    await createConversation(page);

    const input = page.getByLabel("Message input");
    await input.click();
    await input.type("Line 1");
    await input.press("Shift+Enter");
    await input.type("Line 2");

    // The message should NOT have been sent
    const value = await input.inputValue();
    expect(value).toContain("Line 1");
    expect(value).toContain("Line 2");
  });

  test("input clears after sending", async ({ page }) => {
    await createConversation(page);

    const input = page.getByLabel("Message input");
    await sendMessage(page, "Clear test");

    // Input should be cleared after send
    await expect(input).toHaveValue("");
  });

  test("messages appear in chronological order", async ({ page }) => {
    await createConversation(page);

    // Send first message
    await sendMessage(page, "First message");
    await expect(page.getByText("First message")).toBeVisible({ timeout: 10_000 });

    // Wait for streaming to finish before sending another message
    await ensureNotStreaming(page);

    // Send second message
    await sendMessage(page, "Second message");
    await expect(page.getByText("Second message")).toBeVisible({ timeout: 10_000 });

    // Verify order: "First message" should appear before "Second message" in DOM
    const allText = await page.locator("[class*='py-3']").allTextContents();
    const firstIndex = allText.findIndex((t) => t.includes("First message"));
    const secondIndex = allText.findIndex((t) => t.includes("Second message"));
    expect(firstIndex).toBeLessThan(secondIndex);
  });
});

test.describe("Conversation navigation", () => {
  test("navigating to a conversation shows message history", async ({ page }) => {
    await loginAndGoHome(page);

    // Create a conversation by sending a message from the home page
    const homeInput = page.getByPlaceholder("Ask anything...");
    await expect(homeInput).toBeVisible({ timeout: 10_000 });
    await homeInput.fill("History test message");
    await page.getByRole("button", { name: /send/i }).click();

    // Wait for redirect through /conversations/new to /conversations/:uuid
    await page.waitForURL(/\/conversations\/[0-9a-f]{8}-/, { timeout: 20_000 });
    await expect(page.getByText("History test message").first()).toBeVisible({ timeout: 10_000 });

    // Capture the conversation URL
    const convUrl = page.url();

    // Navigate away and back to verify history persists
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");
    await page.goto(convUrl);

    // Verify message appears
    await expect(page.getByText("History test message").first()).toBeVisible({ timeout: 10_000 });
  });
});
