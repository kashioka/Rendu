/**
 * Parse SVG markup produced by Mermaid into a detached <svg> element.
 *
 * Mermaid emits HTML-flavored labels inside <foreignObject> (e.g. an unclosed
 * `<br>` from a `<br/>` line break in a node label). A strict XML parser
 * (`image/svg+xml`) rejects that as malformed and aborts at the FIRST error,
 * silently dropping the rest of the diagram — so any diagram with a multi-line
 * label renders only partially (most nodes vanish). The HTML parser tolerates
 * void elements like `<br>`, so the whole diagram survives.
 *
 * This stays XSS-safe: DOMParser never executes scripts, and Mermaid runs with
 * `securityLevel: "strict"`, which sanitizes the markup before it reaches here.
 */
export function parseSvgMarkup(svg: string): SVGSVGElement | null {
  const doc = new DOMParser().parseFromString(svg, "text/html");
  return doc.querySelector("svg");
}
