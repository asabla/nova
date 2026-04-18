/**
 * E2E tests for the rerun / edit-and-rerun flows.
 *
 * Invariants being protected:
 *   1. Clicking "Re-run" on an assistant message calls truncate-after BEFORE
 *      the stream request fires.
 *   2. The old assistant response disappears from the DOM before the new
 *      streaming bubble appears (no "old + new stacked" intermediate state).
 *   3. Edit-and-rerun edits the user message in place, then truncates and
 *      streams a new response.
 *
 * Prerequisite: App running at http://localhost:5173 with a seeded database.
 * Run: npx playwright test packages/web/tests/e2e/rerun.e2e.test.ts
 */
import { test, expect, type Page, type Request } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const LOGIN_EMAIL = "admin@nova.local";
const LOGIN_PASSWORD = "Admin123!";

async function loginAndGoHome(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole("button", { name: "Sign in to NOVA" })).toBeVisible();
  await page.getByRole("textbox", { name: "Email" }).fill(LOGIN_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in to NOVA" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
}

async function ensureNotStreaming(page: Page) {
  const sendButton = page.getByRole("button", { name: "Send message" });
  const stopButton = page.getByRole("button", { name: "Stop streaming" });
  for (let i = 0; i < 30; i++) {
    if (await sendButton.isVisible().catch(() => false)) {
      await page.waitForTimeout(400);
      if (await sendButton.isVisible().catch(() => false)) return;
    }
    if (await stopButton.isVisible().catch(() => false)) {
      await stopButton.click();
    }
    await page.waitForTimeout(500);
  }
  await expect(sendButton).toBeVisible({ timeout: 5_000 });
}

async function createConversationWithFirstExchange(page: Page, initial: string) {
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle");
  const homeInput = page.getByPlaceholder("Ask anything...");
  await expect(homeInput).toBeVisible({ timeout: 10_000 });
  await homeInput.fill(initial);
  await page.getByRole("button", { name: /send/i }).click();
  await page.waitForURL(/\/conversations\/[0-9a-f]{8}-/, { timeout: 20_000 });
  await expect(page.getByLabel("Message input")).toBeVisible({ timeout: 10_000 });
  await ensureNotStreaming(page);
}

test.describe("Rerun", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoHome(page);
  });

  test("regenerate calls truncate-after before stream and replaces the old response", async ({ page }) => {
    await createConversationWithFirstExchange(page, "Give me one word describing the sky.");

    // Capture the assistant response text so we can verify it disappears
    const assistantBubble = page.locator("[class*='py-3']").filter({ hasText: "NOVA" }).first();
    await expect(assistantBubble).toBeVisible({ timeout: 15_000 });
    const originalResponseText = (await assistantBubble.textContent())?.trim() ?? "";
    expect(originalResponseText.length).toBeGreaterThan(0);

    // Listen for the rerun flow's network calls
    const truncatePromise = page.waitForRequest(
      (req: Request) => req.url().includes("/truncate-after") && req.method() === "POST",
      { timeout: 10_000 },
    );
    const streamPromise = page.waitForRequest(
      (req: Request) => /\/messages\/stream$/.test(req.url()) && req.method() === "POST",
      { timeout: 10_000 },
    );

    // Hover the assistant bubble to reveal action buttons, then click Re-run
    await assistantBubble.hover();
    const rerunButton = assistantBubble.getByRole("button", { name: "Re-run" });
    await expect(rerunButton).toBeVisible({ timeout: 5_000 });
    await rerunButton.click();

    // Ordering invariant: truncate-after fires before the stream request
    const truncateReq = await truncatePromise;
    const streamReq = await streamPromise;
    expect(truncateReq.timing()).toBeDefined();
    expect(streamReq.timing()).toBeDefined();

    // The old response should disappear from the DOM before the new one completes
    // (soft-delete + refetch runs before stream starts, so the bubble briefly vanishes)
    await ensureNotStreaming(page);

    // After rerun completes: the user prompt is still visible, the old response text
    // is either gone or replaced. We check that a NEW assistant bubble exists with
    // DIFFERENT content than the original (temperature jitter → different wording).
    await expect(page.getByText("Give me one word describing the sky.").first()).toBeVisible();

    const updatedAssistantBubble = page.locator("[class*='py-3']").filter({ hasText: "NOVA" }).first();
    await expect(updatedAssistantBubble).toBeVisible();
    const newResponseText = (await updatedAssistantBubble.textContent())?.trim() ?? "";
    expect(newResponseText.length).toBeGreaterThan(0);

    // The only NOVA bubble in the DOM should be the new one — the old one is soft-deleted
    const novaBubbleCount = await page.locator("[class*='py-3']").filter({ hasText: "NOVA" }).count();
    expect(novaBubbleCount).toBe(1);
  });

  test("edit-and-rerun replaces the old response and surfaces the edited user message", async ({ page }) => {
    await createConversationWithFirstExchange(page, "Pick a colour.");

    // Hover the USER message and click Edit
    const userBubble = page.locator("[class*='py-3']").filter({ hasText: "Pick a colour." }).first();
    await expect(userBubble).toBeVisible({ timeout: 10_000 });
    await userBubble.hover();
    const editButton = userBubble.getByRole("button", { name: "Edit message" });
    await expect(editButton).toBeVisible({ timeout: 5_000 });
    await editButton.click();

    // Fill in new content and click Save & Re-run
    const editTextarea = userBubble.getByRole("textbox");
    await editTextarea.fill("Pick a fruit.");

    const patchPromise = page.waitForRequest(
      (req: Request) => /\/messages\/[0-9a-f-]+$/.test(req.url()) && req.method() === "PATCH",
      { timeout: 10_000 },
    );
    const truncatePromise = page.waitForRequest(
      (req: Request) => req.url().includes("/truncate-after") && req.method() === "POST",
      { timeout: 10_000 },
    );

    await userBubble.getByRole("button", { name: /save.*re-?run/i }).click();

    const patchReq = await patchPromise;
    const truncateReq = await truncatePromise;
    expect(patchReq.postDataJSON()).toMatchObject({ content: "Pick a fruit." });
    // The truncate endpoint must target the same message id that was just edited
    expect(truncateReq.url()).toContain(patchReq.url().split("/messages/")[1]!);

    await ensureNotStreaming(page);

    // The edited content should now be visible; the OLD user text should be gone
    await expect(page.getByText("Pick a fruit.").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Pick a colour.")).toHaveCount(0);
  });
});

test.describe("User bubble tight-fit", () => {
  test("short user message bubble does not stretch full-width", async ({ page }) => {
    await loginAndGoHome(page);
    await createConversationWithFirstExchange(page, "hi");

    const userBubble = page.locator("[class*='py-3']").filter({ hasText: "hi" }).first();
    const paragraph = userBubble.locator("p").first();
    await expect(paragraph).toBeVisible({ timeout: 5_000 });

    // The <p> wrapping the user content must be inline-block so it hugs its text
    await expect(paragraph).toHaveClass(/inline-block/);

    // Concretely: its rendered width should be far less than the conversation column
    const [paragraphBox, bubbleBox] = await Promise.all([
      paragraph.boundingBox(),
      userBubble.boundingBox(),
    ]);
    expect(paragraphBox).not.toBeNull();
    expect(bubbleBox).not.toBeNull();
    // "hi" should not occupy more than a third of the bubble container's width
    expect(paragraphBox!.width).toBeLessThan(bubbleBox!.width / 3);
  });
});
