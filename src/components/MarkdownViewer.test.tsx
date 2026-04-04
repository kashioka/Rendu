import { describe, it, expect, vi, type Mock } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
import { MarkdownViewer } from './MarkdownViewer';
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
});
