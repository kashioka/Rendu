import type { Root, RootContent, Element } from "hast";

/**
 * Stamp every rendered element with the 1-based markdown line it starts on
 * (`data-source-line`). Search results are collected from the raw markdown by
 * line, so this attribute is what ties a result back to its exact DOM element —
 * without it the jump had to guess by matching ordinals between two separate
 * scans, which drifts apart on adjacent table rows (#128).
 *
 * Must run LAST in the rehype chain: after rehype-sanitize, so a document
 * containing raw `<div data-source-line="1">` cannot forge a jump target
 * (sanitize drops it, then this stamps the trusted value).
 */
export default function rehypeSourceLine() {
  return (tree: Root) => {
    const walk = (node: Root | RootContent) => {
      if (node.type === "element") {
        const line = node.position?.start?.line;
        if (typeof line === "number") {
          const el = node as Element;
          el.properties = { ...el.properties, "data-source-line": String(line) };
        }
      }
      if ("children" in node) node.children.forEach(walk);
    };
    walk(tree);
  };
}

/**
 * Resolve a markdown line number to the element that renders it: an exact
 * `data-source-line` hit, else the innermost block that starts above it (a line
 * in the middle of a paragraph maps to the paragraph). Ties on the same line —
 * `table`/`tr`/`td` all start on the row's line — resolve to the outermost,
 * i.e. the whole row rather than one cell.
 */
export function findElementForLine(root: HTMLElement, lineNum: number): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestLine = -1;
  for (const el of root.querySelectorAll<HTMLElement>("[data-source-line]")) {
    const line = Number(el.dataset.sourceLine);
    if (!Number.isFinite(line) || line > lineNum) continue;
    if (line > bestLine) {
      best = el;
      bestLine = line;
    }
  }
  return best;
}
