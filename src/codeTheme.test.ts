import { describe, it, expect, beforeEach, vi } from "vitest";

// vitest runs with `css: false`, so the real `?inline` imports are empty
// strings; stand-ins make the selected palette observable.
vi.mock("highlight.js/styles/github-dark.css?inline", () => ({ default: ".hljs{color:DARK}" }));
vi.mock("highlight.js/styles/github.css?inline", () => ({ default: ".hljs{color:LIGHT}" }));

import { applyCodeTheme } from "./codeTheme";

describe("applyCodeTheme", () => {
  beforeEach(() => {
    document.getElementById("hljs-theme")?.remove();
  });

  // The theme must lose to the app's unlayered rules regardless of DOM
  // order, or its `pre code.hljs` padding overrides the app's
  // equal-specificity reset (issue #223 review).
  it("wraps the theme in a cascade layer", () => {
    applyCodeTheme(false);
    const css = document.getElementById("hljs-theme")!.textContent ?? "";
    expect(css.trimStart().startsWith("@layer hljs-theme {")).toBe(true);
    expect(css.trimEnd().endsWith("}")).toBe(true);
  });

  it("reuses one element and swaps the palette", () => {
    applyCodeTheme(false);
    applyCodeTheme(true);
    const els = document.querySelectorAll("#hljs-theme");
    expect(els).toHaveLength(1);
    expect((els[0] as HTMLStyleElement).dataset.theme).toBe("dark");
    expect(els[0].textContent).toContain("DARK");
    expect(els[0].textContent).not.toContain("LIGHT");
  });

  it("loads the light palette for light themes", () => {
    applyCodeTheme(true);
    applyCodeTheme(false);
    const css = document.getElementById("hljs-theme")!.textContent ?? "";
    expect(css).toContain("LIGHT");
    expect(css).not.toContain("DARK");
  });
});
