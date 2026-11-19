// Syntax-highlight palette for fenced code blocks, matched to the resolved
// app palette. Both highlight.js themes style the same global `.hljs-*`
// classes, so they can't both be imported; the active one is swapped into a
// single <style> element instead. Previously github-dark was always loaded,
// leaving pale tokens on the light code background (issue #223).
import darkCss from "highlight.js/styles/github-dark.css?inline";
import lightCss from "highlight.js/styles/github.css?inline";

const STYLE_ID = "hljs-theme";

// The theme goes in a cascade layer so the app's unlayered rules always win,
// wherever this element sits in <head>. Without it, the theme's
// `pre code.hljs { padding: 1em }` ties `.markdown-body pre code { padding: 0 }`
// on specificity and wins whenever it comes later (e.g. after an HMR update),
// doubling the padding on highlighted blocks only.
const wrap = (css: string) => `@layer hljs-theme {\n${css}\n}`;

export function applyCodeTheme(isDark: boolean): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.dataset.theme = isDark ? "dark" : "light";
  el.textContent = wrap(isDark ? darkCss : lightCss);
}
