import { test, expect } from "../fixtures";

test.describe("App launch", () => {
  test("renders the welcome screen with action buttons", async ({
    tauriPage,
    page,
  }) => {
    // Capture errors for debugging
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Wait for React to mount
    await page.waitForSelector(".titlebar-text", { timeout: 10_000 });

    // Title bar
    const title = await tauriPage.textContent(".titlebar-text");
    expect(title).toBe("Rendu");

    // Welcome heading
    const heading = await tauriPage.textContent(".empty-state-heading");
    expect(heading).toBeTruthy();

    // Open Folder / Open File buttons
    const buttons = await page.locator(".empty-state-actions .btn").count();
    expect(buttons).toBe(2);

    // No fatal errors
    expect(errors).toEqual([]);
  });

  test("sidebar toggles visibility", async ({ tauriPage, page }) => {
    await page.waitForSelector(".titlebar-text", { timeout: 10_000 });

    // Sidebar visible initially
    expect(await tauriPage.isVisible(".sidebar")).toBe(true);

    // Toggle off
    await tauriPage.click(".titlebar-toggle");
    await page.waitForTimeout(300);
    expect(await tauriPage.isVisible(".sidebar")).toBe(false);

    // Toggle back on
    await tauriPage.click(".titlebar-toggle");
    await page.waitForTimeout(300);
    expect(await tauriPage.isVisible(".sidebar")).toBe(true);
  });
});
