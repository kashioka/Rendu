import { describe, it, expect, vi, type Mock } from 'vitest';
import { createRef } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '../test/helpers';

vi.mock('@tauri-apps/plugin-fs', () => import('../test/mocks/tauri-fs'));
vi.mock('@tauri-apps/plugin-dialog', () => import('../test/mocks/tauri-dialog'));
vi.mock('html2pdf.js', () => ({
  default: vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    outputPdf: vi.fn().mockResolvedValue(new Blob()),
  })),
}));
vi.mock('mermaid', () => import('../test/mocks/mermaid'));
vi.mock('../utils/svgToPng', () => ({
  svgToPng: vi.fn().mockResolvedValue({ dataUrl: '', width: 0, height: 0 }),
}));

import { readTextFile } from '@tauri-apps/plugin-fs';
import { MarkdownViewer, type MarkdownViewerHandle } from './MarkdownViewer';
import { darkPreset } from '../useSettings';

describe('MarkdownViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    (readTextFile as Mock).mockReturnValue(new Promise(() => {})); // never resolves
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state when file read fails', async () => {
    (readTextFile as Mock).mockRejectedValue(new Error('File not found'));
    renderWithLocale(
      <MarkdownViewer filePath="/missing.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('Failed to load file')).toBeInTheDocument();
    });
  });

  it('renders markdown content', async () => {
    (readTextFile as Mock).mockResolvedValue('# Hello World\n\nSome text here.');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
    expect(screen.getByText('Some text here.')).toBeInTheDocument();
  });

  it('shows zoom controls in toolbar', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    expect(screen.getByText('+')).toBeInTheDocument();
    // The minus sign is '−' (U+2212)
    expect(screen.getByText('−')).toBeInTheDocument();
  });

  it('zoom in increases percentage', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('+'));
    expect(screen.getByText('110%')).toBeInTheDocument();
  });

  it('zoom out decreases percentage', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('−'));
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('zoom reset returns to 100%', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('+'));
    await userEvent.click(screen.getByText('+'));
    expect(screen.getByText('120%')).toBeInTheDocument();
    await userEvent.click(screen.getByText('120%')); // Click label to reset
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('calls onHeadingsChange with extracted headings', async () => {
    (readTextFile as Mock).mockResolvedValue('# Title\n## Subtitle');
    const onHeadingsChange = vi.fn();
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} onHeadingsChange={onHeadingsChange} />
    );
    await waitFor(() => {
      expect(onHeadingsChange).toHaveBeenCalled();
    });
    const headings = onHeadingsChange.mock.calls[onHeadingsChange.mock.calls.length - 1][0];
    expect(headings).toHaveLength(2);
    expect(headings[0].text).toBe('Title');
    expect(headings[0].level).toBe(1);
    expect(headings[1].text).toBe('Subtitle');
    expect(headings[1].level).toBe(2);
  });

  it('assigns non-empty, jumpable ids to Japanese (CJK) headings', async () => {
    (readTextFile as Mock).mockResolvedValue('## 日本語版\n\n## English version');
    const onHeadingsChange = vi.fn();
    const { container } = renderWithLocale(
      <MarkdownViewer filePath="/jp.md" settings={darkPreset} onHeadingsChange={onHeadingsChange} />
    );
    await waitFor(() => {
      expect(onHeadingsChange).toHaveBeenCalled();
    });
    const headings = onHeadingsChange.mock.calls.at(-1)![0];
    const jp = headings.find((h: { text: string }) => h.text === '日本語版');
    // 旧実装では \w が CJK を落として id が空になり getElementById で飛べなかった
    expect(jp.id).toBeTruthy();
    expect(jp.id).toContain('日本語版');
    // DOM 上の見出し要素にも同じ id が付いていて getElementById で取得できる
    expect(container.ownerDocument.getElementById(jp.id)).not.toBeNull();
    // 英語側は従来どおりスラグ化される
    const en = headings.find((h: { text: string }) => h.text === 'English version');
    expect(en.id).toBe('english-version');
  });

  it('keeps underscores in heading ids (slug stability)', async () => {
    (readTextFile as Mock).mockResolvedValue('## API_Version');
    const onHeadingsChange = vi.fn();
    renderWithLocale(
      <MarkdownViewer filePath="/u.md" settings={darkPreset} onHeadingsChange={onHeadingsChange} />
    );
    await waitFor(() => {
      expect(onHeadingsChange).toHaveBeenCalled();
    });
    const headings = onHeadingsChange.mock.calls.at(-1)![0];
    expect(headings[0].id).toBe('api_version');
  });

  it('has a search input', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });
  });

  it('zoom does not exceed 200%', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    // Click zoom in 11 times (100 + 110 = 200 max)
    for (let i = 0; i < 11; i++) {
      await userEvent.click(screen.getByText('+'));
    }
    expect(screen.getByText('200%')).toBeInTheDocument();
  });

  it('zoom does not go below 50%', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    // Click zoom out 6 times (100 - 60 = 50 min)
    for (let i = 0; i < 6; i++) {
      await userEvent.click(screen.getByText('−'));
    }
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('search clear button resets search', async () => {
    (readTextFile as Mock).mockResolvedValue('# Hello World\n\nSome text here.');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText('Search...');
    await userEvent.type(input, 'Hello');
    // Clear button should appear
    const clearBtn = screen.getByLabelText('Clear search');
    expect(clearBtn).toBeInTheDocument();
    await userEvent.click(clearBtn);
    expect(input).toHaveValue('');
  });

  it('search area has role=search', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByRole('search')).toBeInTheDocument();
    });
  });

  it('zoom buttons have aria-labels', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
  });

  it('renders <br> as a line break', async () => {
    (readTextFile as Mock).mockResolvedValue('Line one<br>Line two');
    const { container } = renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(container.querySelector('.markdown-body br')).toBeInTheDocument();
    });
  });

  it('renders <details><summary> as collapsible', async () => {
    (readTextFile as Mock).mockResolvedValue(
      '<details><summary>Click me</summary>\n\nHidden content\n\n</details>'
    );
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });
    expect(screen.getByText('Hidden content')).toBeInTheDocument();
  });

  it('renders <kbd> element', async () => {
    (readTextFile as Mock).mockResolvedValue('Press <kbd>Ctrl</kbd>+<kbd>C</kbd>');
    const { container } = renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(container.querySelectorAll('.markdown-body kbd')).toHaveLength(2);
    });
  });

  it('sanitizes <script> tags (XSS prevention)', async () => {
    (readTextFile as Mock).mockResolvedValue(
      'Hello <script>alert("xss")</script> World'
    );
    const { container } = renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText(/Hello/)).toBeInTheDocument();
    });
    expect(container.querySelector('script')).toBeNull();
  });

  it('preserves Mermaid code block detection with rehype-raw', async () => {
    (readTextFile as Mock).mockResolvedValue(
      '```mermaid\ngraph TD;\n  A-->B;\n```'
    );
    const { container } = renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(container.querySelector('.mermaid-container')).toBeInTheDocument();
    });
  });

  it('does not render a toolbar refresh button', async () => {
    (readTextFile as Mock).mockResolvedValue('# Test');
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('Reload file')).toBeNull();
    expect(screen.queryByLabelText('Reload file')).toBeNull();
  });

  it('preserves last content when reload() read fails (deleted file)', async () => {
    (readTextFile as Mock).mockResolvedValueOnce('# Original heading');
    const handle = createRef<MarkdownViewerHandle>();
    renderWithLocale(
      <MarkdownViewer ref={handle} filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('Original heading')).toBeInTheDocument();
    });

    // Simulate the next read failing (e.g. file deleted by user)
    (readTextFile as Mock).mockRejectedValueOnce(new Error('No such file'));
    await act(async () => {
      await handle.current?.reload();
    });

    // Content stays, no error UI is shown
    expect(screen.getByText('Original heading')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load file')).toBeNull();
  });

  it('reload() recovers from an initial error state on successful re-read', async () => {
    // Initial load fails (e.g. file did not exist yet when MarkdownViewer mounted).
    (readTextFile as Mock).mockRejectedValueOnce(new Error('File not found'));
    const handle = createRef<MarkdownViewerHandle>();
    renderWithLocale(
      <MarkdownViewer ref={handle} filePath="/late.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('Failed to load file')).toBeInTheDocument();
    });

    // File now exists; the fs watcher (in real usage) calls reload().
    (readTextFile as Mock).mockResolvedValueOnce('# Recovered');
    await act(async () => {
      await handle.current?.reload();
    });

    await waitFor(() => {
      expect(screen.getByText('Recovered')).toBeInTheDocument();
    });
    expect(screen.queryByText('Failed to load file')).toBeNull();
  });

  it('reload() updates content on successful re-read', async () => {
    (readTextFile as Mock).mockResolvedValueOnce('# First');
    const handle = createRef<MarkdownViewerHandle>();
    renderWithLocale(
      <MarkdownViewer ref={handle} filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('First')).toBeInTheDocument();
    });

    (readTextFile as Mock).mockResolvedValueOnce('# Second');
    await act(async () => {
      await handle.current?.reload();
    });
    await waitFor(() => {
      expect(screen.getByText('Second')).toBeInTheDocument();
    });
  });

  it('hides YAML frontmatter from rendered output', async () => {
    (readTextFile as Mock).mockResolvedValue(
      '---\nmarp: true\ntheme: default\n---\n\n# Slide Title\n\nContent here.'
    );
    renderWithLocale(
      <MarkdownViewer filePath="/test.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(screen.getByText('Slide Title')).toBeInTheDocument();
    });
    expect(screen.getByText('Content here.')).toBeInTheDocument();
    expect(screen.queryByText('marp: true')).not.toBeInTheDocument();
    expect(screen.queryByText('theme: default')).not.toBeInTheDocument();
  });

  describe('KaTeX math rendering', () => {
    it('renders inline math with $$...$$', async () => {
      (readTextFile as Mock).mockResolvedValue('Euler: $$e^{i\\pi} + 1 = 0$$ inline.');
      const { container } = renderWithLocale(
        <MarkdownViewer filePath="/math.md" settings={darkPreset} />
      );
      await waitFor(() => {
        expect(container.querySelector('.katex')).not.toBeNull();
      });
    });

    it('does not treat single-dollar $...$ as math (singleDollarTextMath: false)', async () => {
      (readTextFile as Mock).mockResolvedValue('Plain $x^2$ stays text.');
      const { container } = renderWithLocale(
        <MarkdownViewer filePath="/math.md" settings={darkPreset} />
      );
      await waitFor(() => {
        expect(container.textContent).toContain('Plain $x^2$ stays text.');
      });
      expect(container.querySelector('.katex')).toBeNull();
    });

    it('renders display math with $$...$$', async () => {
      (readTextFile as Mock).mockResolvedValue('$$\n\\frac{a}{b}\n$$');
      const { container } = renderWithLocale(
        <MarkdownViewer filePath="/math.md" settings={darkPreset} />
      );
      await waitFor(() => {
        expect(container.querySelector('.katex-display')).not.toBeNull();
      });
    });

    it('renders display math with ```math fence (GitHub style)', async () => {
      (readTextFile as Mock).mockResolvedValue('```math\nx^2 + y^2 = z^2\n```');
      const { container } = renderWithLocale(
        <MarkdownViewer filePath="/math.md" settings={darkPreset} />
      );
      await waitFor(() => {
        expect(container.querySelector('.katex')).not.toBeNull();
      });
    });

    it('does not crash on invalid math and keeps surrounding content', async () => {
      (readTextFile as Mock).mockResolvedValue(
        'Before\n\n$$\\unknowncommand{x}$$\n\nAfter'
      );
      renderWithLocale(
        <MarkdownViewer filePath="/math.md" settings={darkPreset} />
      );
      await waitFor(() => {
        expect(screen.getByText('Before')).toBeInTheDocument();
      });
      expect(screen.getByText('After')).toBeInTheDocument();
    });

    it('does not treat dollar amounts as math', async () => {
      (readTextFile as Mock).mockResolvedValue('It costs $5 and $10 in total.');
      const { container } = renderWithLocale(
        <MarkdownViewer filePath="/price.md" settings={darkPreset} />
      );
      await waitFor(() => {
        expect(container.textContent).toContain('It costs $5 and $10 in total.');
      });
      expect(container.querySelector('.katex')).toBeNull();
    });
  });

  it('renders GFM footnotes through the sanitize pipeline', async () => {
    (readTextFile as Mock).mockResolvedValue(
      'Body text with a footnote.[^1]\n\n[^1]: The footnote definition text.'
    );
    const { container } = renderWithLocale(
      <MarkdownViewer filePath="/fn.md" settings={darkPreset} />
    );
    await waitFor(() => {
      expect(container.textContent).toContain('The footnote definition text.');
    });
    // 参照リンク (sup > a) が sanitize に剥がされていないこと
    expect(container.querySelector('sup a')).not.toBeNull();
  });
});
