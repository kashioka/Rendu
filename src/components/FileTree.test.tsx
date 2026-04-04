import { describe, it, expect, vi, type Mock } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';

vi.mock('@tauri-apps/plugin-fs', () => import('../test/mocks/tauri-fs'));

import { readDir } from '@tauri-apps/plugin-fs';
import { FileTree } from './FileTree';

const mockEntries = [
  { name: 'README.md', isDirectory: false, isFile: true, isSymlink: false },
  { name: 'docs', isDirectory: true, isFile: false, isSymlink: false },
  { name: '.hidden', isDirectory: false, isFile: true, isSymlink: false },
  { name: 'image.png', isDirectory: false, isFile: true, isSymlink: false },
  { name: 'alpha.md', isDirectory: false, isFile: true, isSymlink: false },
];

describe('FileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (readDir as Mock).mockResolvedValue(mockEntries);
  });

  it('renders files from readDir', async () => {
    render(<FileTree rootDir="/root" selectedFile={null} onSelectFile={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });
  });

  it('filters out hidden files', async () => {
    render(<FileTree rootDir="/root" selectedFile={null} onSelectFile={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });
    expect(screen.queryByText('.hidden')).not.toBeInTheDocument();
  });

  it('sorts directories before files', async () => {
    render(<FileTree rootDir="/root" selectedFile={null} onSelectFile={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('docs')).toBeInTheDocument();
    });
    const items = screen.getAllByText(/(docs|alpha\.md|README\.md|image\.png)/);
    expect(items[0].textContent).toBe('docs');
  });

  it('calls onSelectFile when clicking a markdown file', async () => {
    const onSelectFile = vi.fn();
    render(<FileTree rootDir="/root" selectedFile={null} onSelectFile={onSelectFile} />);
    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('README.md'));
    expect(onSelectFile).toHaveBeenCalledWith('/root/README.md');
  });

  it('does not call onSelectFile for non-markdown files', async () => {
    const onSelectFile = vi.fn();
    render(<FileTree rootDir="/root" selectedFile={null} onSelectFile={onSelectFile} />);
    await waitFor(() => {
      expect(screen.getByText('image.png')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('image.png'));
    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it('shows error when readDir fails', async () => {
    (readDir as Mock).mockRejectedValue(new Error('Permission denied'));
    render(<FileTree rootDir="/root" selectedFile={null} onSelectFile={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
    });
  });

  it('expands directory on click', async () => {
    (readDir as Mock)
      .mockResolvedValueOnce(mockEntries) // initial load
      .mockResolvedValueOnce([ // docs subdirectory
        { name: 'guide.md', isDirectory: false, isFile: true, isSymlink: false },
      ]);

    render(<FileTree rootDir="/root" selectedFile={null} onSelectFile={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('docs')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('docs'));
    await waitFor(() => {
      expect(screen.getByText('guide.md')).toBeInTheDocument();
    });
  });
});
