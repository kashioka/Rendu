import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithLocale } from '../test/helpers';

vi.mock('mermaid', () => import('../test/mocks/mermaid'));
vi.mock('../utils/svgToPng', () => ({
  svgToPng: vi.fn().mockResolvedValue({
    dataUrl: 'data:image/png;base64,mock',
    width: 200,
    height: 100,
  }),
}));

import mermaid from 'mermaid';
import { MermaidBlock } from './MermaidBlock';
import { darkPreset } from '../useSettings';

describe('MermaidBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing on success', async () => {
    (mermaid.render as ReturnType<typeof vi.fn>).mockResolvedValue({
      svg: '<svg class="test-svg"><text>Hello</text></svg>',
    });
    const { container } = renderWithLocale(
      <MermaidBlock code="graph TD; A-->B;" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(container.querySelector('.mermaid-container')).toBeTruthy();
    });
  });

  it('shows error state when mermaid.render fails', async () => {
    (mermaid.render as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Parse error')
    );
    renderWithLocale(
      <MermaidBlock code="invalid mermaid" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('Mermaid render error')).toBeInTheDocument();
    });
    // Raw code is displayed in error state
    expect(screen.getByText('invalid mermaid')).toBeInTheDocument();
  });

  it('calls mermaid.initialize with settings', async () => {
    (mermaid.render as ReturnType<typeof vi.fn>).mockResolvedValue({ svg: '<svg></svg>' });
    renderWithLocale(
      <MermaidBlock code="graph TD; A-->B;" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(mermaid.initialize).toHaveBeenCalled();
    });
    const initArg = (mermaid.initialize as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(initArg.theme).toBe(darkPreset.mermaidTheme);
  });
});
