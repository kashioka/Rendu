import { describe, it, expect } from 'vitest';
import { parseSvgMarkup } from './svgParse';

describe('parseSvgMarkup', () => {
  it('returns the svg element for well-formed markup', () => {
    const svg = parseSvgMarkup('<svg><g class="node"><rect/></g></svg>');
    expect(svg).not.toBeNull();
    expect(svg?.tagName.toLowerCase()).toBe('svg');
  });

  it('keeps every node when a label contains an unclosed <br> (Mermaid line break)', () => {
    // Regression: Mermaid emits <br> (not <br/>) inside <foreignObject> labels.
    // A strict image/svg+xml parse aborts at the first <br> and drops the rest
    // of the diagram; the HTML parser must preserve all three nodes here.
    const markup = `<svg>
      <g class="node"><rect/><foreignObject><div>line 1<br>line 2</div></foreignObject></g>
      <g class="node"><rect/></g>
      <g class="node"><rect/></g>
    </svg>`;
    const svg = parseSvgMarkup(markup);
    expect(svg).not.toBeNull();
    expect(svg?.querySelectorAll('.node').length).toBe(3);
  });

  it('returns null when there is no svg element', () => {
    expect(parseSvgMarkup('<div>not an svg</div>')).toBeNull();
  });
});
