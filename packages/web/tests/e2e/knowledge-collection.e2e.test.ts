/**
 * E2E tests for the Knowledge Collection web UI flow.
 *
 * Tests the full user journey:
 * - Navigate to knowledge page
 * - Create a new collection via the /knowledge/new page
 * - Verify navigation to collection detail
 * - Delete the collection
 * - Verify return to knowledge list
 *
 * Prerequisite: App running at http://localhost:5173 with a seeded database.
 * Run: npx playwright test packages/web/tests/e2e/knowledge-collection.e2e.test.ts
 */
import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const LOGIN_EMAIL = "admin@nova.local";
const LOGIN_PASSWORD = "Admin123!";

/** Helper: log in and navigate to the knowledge page */
async function loginAndGoToKnowledge(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole("button", { name: "Sign in to NOVA" })).toBeVisible();
  await page.getByRole("textbox", { name: "Email" }).fill(LOGIN_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in to NOVA" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
  await page.goto(`${BASE_URL}/knowledge`);
  await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible({ timeout: 10_000 });
}

/** Helper: create a collection via the /knowledge/new page */
async function createCollection(page: Page, name: string, description?: string) {
  await page.getByRole("button", { name: "New Collection" }).click();
  // Should navigate to the creation page
  await expect(page).toHaveURL(/\/knowledge\/new/);
  await expect(page.getByRole("heading", { name: "Create Knowledge Collection" })).toBeVisible();

  await page.getByRole("textbox", { name: "Name" }).fill(name);
  if (description) {
    await page.getByRole("textbox", { name: /description/i }).fill(description);
  }
  // Click Create and wait for the API response
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/knowledge") && res.request().method() === "POST"),
    page.getByRole("button", { name: "Create" }).click(),
  ]);
  expect(response.status()).toBe(201);
  // Wait for the detail page to load by checking the heading
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible({ timeout: 10_000 });
}

/** Helper: delete the currently viewed collection */
async function deleteCurrentCollection(page: Page) {
  await page.getByRole("button", { name: "Delete" }).click();
  const deleteDialog = page.getByLabel("Delete Collection");
  await expect(deleteDialog).toBeVisible();
  // Click Delete and wait for the API response
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/knowledge/") && res.request().method() === "DELETE"),
    deleteDialog.getByRole("button", { name: "Delete" }).click(),
  ]);
  expect(response.status()).toBe(204);
  // Wait for Knowledge Base heading to appear (means we navigated back to list)
  await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible({ timeout: 10_000 });
}

test.describe("Knowledge Collection UI", () => {
  test("creates a new knowledge collection and verifies detail page", async ({ page }) => {
    await loginAndGoToKnowledge(page);

    // Click "New Collection" button — navigates to /knowledge/new
    await page.getByRole("button", { name: "New Collection" }).click();
    await expect(page).toHaveURL(/\/knowledge\/new/);

    // Verify the creation page
    await expect(page.getByRole("heading", { name: "Create Knowledge Collection" })).toBeVisible();

    // Verify Create button is disabled when name is empty
    await expect(page.getByRole("button", { name: "Create" })).toBeDisabled();

    // Fill in the form
    await page.getByRole("textbox", { name: "Name" }).fill("E2E UI Test Collection");
    await page.getByRole("textbox", { name: /description/i }).fill("Created via E2E UI test");

    // Create button should now be enabled
    await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();

    // Submit and wait for API response
    const [createResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/knowledge") && res.request().method() === "POST"),
      page.getByRole("button", { name: "Create" }).click(),
    ]);
    expect(createResponse.status()).toBe(201);

    // Should navigate to the new collection's detail page
    await expect(page.getByRole("heading", { name: "E2E UI Test Collection", level: 1 })).toBeVisible({ timeout: 10_000 });

    // Verify detail page tabs are present (scoped to main content area)
    const main = page.getByRole("main");
    await expect(main.getByRole("tab", { name: "Documents" })).toBeVisible();
    await expect(main.getByRole("tab", { name: "Sources" })).toBeVisible();
    await expect(main.getByRole("tab", { name: "Search" })).toBeVisible();
    await expect(main.getByRole("tab", { name: "Settings" })).toBeVisible();
    await expect(main.getByRole("tab", { name: "Activity" })).toBeVisible();

    // Clean up: delete the collection
    await deleteCurrentCollection(page);
  });

  test("cancels collection creation and returns to list", async ({ page }) => {
    await loginAndGoToKnowledge(page);

    // Navigate to creation page
    await page.getByRole("button", { name: "New Collection" }).click();
    await expect(page).toHaveURL(/\/knowledge\/new/);

    // Fill in name
    await page.getByRole("textbox", { name: "Name" }).fill("Should Not Be Created");

    // Cancel — should navigate back to knowledge list
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible({ timeout: 10_000 });
  });

  test("creates and then deletes a collection", async ({ page }) => {
    await loginAndGoToKnowledge(page);

    // Create collection
    await createCollection(page, "E2E Deletable Collection");

    // Delete the collection
    await deleteCurrentCollection(page);

    // Reload to ensure we get fresh data (TanStack Query cache may show stale data briefly)
    await page.reload();
    await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible({ timeout: 10_000 });

    // The deleted collection should not appear in the list
    await expect(page.getByText("E2E Deletable Collection")).not.toBeVisible();
  });
});
