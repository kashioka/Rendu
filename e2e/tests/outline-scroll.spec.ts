import { createTauriTest } from "@srsholmes/tauri-playwright";

// #229 end to end: open a document with 50 headings (folder path row shown,
// as in the report), scroll the outline to the bottom, and the last heading
// must be fully visible. Mock handlers are stringified into the page, so each
// one must be self-contained.
const { test, expect } = createTauriTest({
  devUrl: "http://localhost:14173",
  ipcMocks: {
    check_for_updates: () => ({
      has_update: false,
      latest_version: "0.5.0",
      current_version: "0.5.0",
      release_url: "",
      download_url: "",
    }),
    get_initial_file: () => "/docs/many-headings.md",
    start_watching: () => null,
    stop_watching: () => null,
    "plugin:fs|read_dir": () => [
      { name: "many-headings.md", isFile: true, isDirectory: false, isSymlink: false },
    ],
    "plugin:fs|stat": () => ({
      isFile: true, isDirectory: false, isSymlink: false, size: 1000,
      mtime: 0, atime: 0, birthtime: 0, readonly: false, fileAttributes: null,
      dev: 0, ino: 0, mode: 0, nlink: 1, uid: 0, gid: 0, rdev: 0, blksize: 0, blocks: 0,
    }),
    "plugin:fs|read_text_file": () => {
      let md = "";
      for (let i = 1; i <= 50; i++) md += "## Heading " + i + "\n\ntext\n\n";
      return Array.from(new TextEncoder().encode(md));
    },
  },
});

test("last outline item is reachable by scrolling (#229)", async ({ tauriPage, page }) => {
  void tauriPage; // the fixture opens the app with the IPC mocks
  await page.setViewportSize({ width: 900, height: 500 });
  const last = page.locator(".outline-item", { hasText: /^Heading 50$/ });
  await last.waitFor({ timeout: 10_000 });

  const pane = page.locator(".sidebar-outline-pane");
  await pane.evaluate((el) => { el.scrollTop = el.scrollHeight; });

  const lastBox = (await last.boundingBox())!;
  const paneBox = (await pane.boundingBox())!;
  const sidebarBox = (await page.locator(".sidebar-wrapper").boundingBox())!;
  const visibleBottom = Math.min(paneBox.y + paneBox.height, sidebarBox.y + sidebarBox.height);
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(visibleBottom + 0.5);
});
