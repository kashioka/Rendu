import { test, expect } from "../fixtures";

// #229: the file tree and outline panes were sized as % of the whole sidebar,
// so together with the header and divider they overflowed it and the end of
// the outline was clipped. Both panes must end inside the sidebar.
test.describe("Sidebar split layout", () => {
  for (const viewport of [
    { width: 1200, height: 800 },
    { width: 900, height: 500 },
  ]) {
    test(`panes stay inside the sidebar at ${viewport.width}x${viewport.height}`, async ({ tauriPage, page }) => {
      void tauriPage; // the fixture opens the app with the IPC mocks
      await page.setViewportSize(viewport);
      await page.waitForSelector(".titlebar-text", { timeout: 10_000 });

      const boxes = await page.evaluate(() => {
        const bottom = (sel: string) => document.querySelector(sel)!.getBoundingClientRect().bottom;
        return {
          sidebar: bottom(".sidebar-wrapper"),
          tree: bottom(".sidebar-tree-pane"),
          outline: bottom(".sidebar-outline-pane"),
        };
      });

      expect(boxes.tree).toBeLessThanOrEqual(boxes.outline);
      expect(boxes.outline).toBeLessThanOrEqual(boxes.sidebar + 0.5);
    });
  }

  test("divider follows the pointer while dragging", async ({ tauriPage, page }) => {
    void tauriPage;
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForSelector(".titlebar-text", { timeout: 10_000 });

    const divider = page.locator(".sidebar-divider");
    const start = (await divider.boundingBox())!;
    await page.mouse.move(start.x + 40, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, 300, { steps: 5 });
    await page.mouse.up();

    const end = (await divider.boundingBox())!;
    expect(Math.abs(end.y + end.height / 2 - 300)).toBeLessThanOrEqual(2);
  });
});
