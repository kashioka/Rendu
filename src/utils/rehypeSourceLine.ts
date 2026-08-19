import type { Root, RootContent, Element } from "hast";

/**
 * Stamp every rendered element with the 1-based markdown lines it spans
 * (`data-source-line` / `data-source-line-end`). Search results are collected
 * from the raw markdown by line, so these attributes are what tie a result back
 * to its exact DOM element — without them the jump had to guess by matching
 * ordinals between two separate scans, which drifts apart on adjacent table
 * rows (#128).
 *
 * Must run LAST in the rehype chain: after rehype-sanitize, so a document
 * containing raw `<div data-source-line="1">` cannot forge a jump target
 * (sanitize drops it, then this stamps the trusted value).
 */
export default function rehypeSourceLine() {
  return (tree: Root) => {
    const walk = (node: Root | RootContent) => {
      if (node.type === "element") {
        const start = node.position?.start?.line;
        const end = node.position?.end?.line;
        if (typeof start === "number") {
          const el = node as Element;
          el.properties = {
            ...el.properties,
            "data-source-line": String(start),
            "data-source-line-end": String(typeof end === "number" ? end : start),
          };
        }
      }
      if ("children" in node) node.children.forEach(walk);
    };
    walk(tree);
  };
}

/**
 * Resolve a markdown line number to the element that renders it: the *narrowest*
 * element whose source range covers the line. Narrowest, not outermost: a table
 * body starts on the same line as its first row, so preferring the outer element
 * lit up the whole table when the first row was picked. Elements covering the
 * same range (`tr` and its `td`, `thead` and its `tr`) resolve to the outermost,
 * i.e. the whole row rather than one cell.
 *
 * A line no element covers — a blank line, or one the renderer collapsed — falls
 * back to the nearest block starting above it.
 */
export function findElementForLine(root: HTMLElement, lineNum: number): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestSpan = Infinity;
  let fallback: HTMLElement | null = null;
  let fallbackLine = -1;

  for (const el of root.querySelectorAll<HTMLElement>("[data-source-line]")) {
    const start = Number(el.dataset.sourceLine);
    if (!Number.isFinite(start) || start > lineNum) continue;
    const parsedEnd = Number(el.dataset.sourceLineEnd);
    const end = Number.isFinite(parsedEnd) ? Math.max(parsedEnd, start) : start;

    if (start > fallbackLine) {
      fallback = el;
      fallbackLine = start;
    }
    // Strict <: on an identical range the first element in document order —
    // the outer one — wins.
    if (end >= lineNum && end - start < bestSpan) {
      best = el;
      bestSpan = end - start;
    }
  }
  return best ?? fallback;
}
