import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@tauri-apps/api/core', () => import('./test/mocks/tauri-core'));
vi.mock('@tauri-apps/api/event', () => import('./test/mocks/tauri-event'));
vi.mock('@tauri-apps/api/webview', () => import('./test/mocks/tauri-webview'));
vi.mock('@tauri-apps/plugin-dialog', () => import('./test/mocks/tauri-dialog'));
vi.mock('@tauri-apps/plugin-fs', () => import('./test/mocks/tauri-fs'));
vi.mock('html2pdf.js', () => ({
  default: vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    outputPdf: vi.fn().mockResolvedValue(new Blob()),
  })),
}));
vi.mock('mermaid', () => import('./test/mocks/mermaid'));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import App from './App';

type FsChangedHandler = (event: { payload: { kind: 'file' | 'directory'; path: string } }) => void;

describe('App fs-watch integration', () => {
  let fsChangedHandlers: FsChangedHandler[];

  beforeEach(() => {
    vi.clearAllMocks();
    fsChangedHandlers = [];
    (invoke as Mock).mockResolvedValue(null);
    (listen as Mock).mockImplementation((eventName: string, handler: FsChangedHandler) => {
      if (eventName === 'fs-changed') fsChangedHandlers.push(handler);
      return Promise.resolve(() => {});
    });
    (readDir as Mock).mockResolvedValue([]);
    (readTextFile as Mock).mockResolvedValue('# Initial content');
  });

  function watchCalls() {
    return (invoke as Mock).mock.calls.filter(
      ([cmd]) => cmd === 'start_watching' || cmd === 'stop_watching',
    );
  }

  it('calls stop_watching on initial mount (no file or folder)', async () => {
    render(<App />);
    await waitFor(() => {
      expect(
        watchCalls().some(([cmd]) => cmd === 'stop_watching'),
      ).toBe(true);
    });
  });

  it('starts watching directory when a folder is opened', async () => {
    (openDialog as Mock).mockResolvedValueOnce('/my/folder');
    render(<App />);
    const folderBtn = await screen.findByTitle(/folder/i, { exact: false });
    await userEvent.click(folderBtn);

    await waitFor(() => {
      expect(
        watchCalls().some(
          ([cmd, args]) =>
            cmd === 'start_watching' &&
            args?.path === '/my/folder' &&
            args?.kind === 'directory',
        ),
      ).toBe(true);
    });
  });

  it('starts watching file (overrides folder) when a markdown file is opened', async () => {
    (openDialog as Mock).mockResolvedValueOnce('/my/notes/intro.md');
    render(<App />);
    const fileBtns = await screen.findAllByTitle(/file/i, { exact: false });
    // The second toolbar button is "Open file"
    const openFileBtn = fileBtns.find((b) => b.textContent?.toLowerCase().includes('file')) ?? fileBtns[1];
    await userEvent.click(openFileBtn);

    await waitFor(() => {
      expect(
        watchCalls().some(
          ([cmd, args]) =>
            cmd === 'start_watching' &&
            args?.path === '/my/notes/intro.md' &&
            args?.kind === 'file',
        ),
      ).toBe(true);
    });
  });

  it('registers a listener for "fs-changed" event', async () => {
    render(<App />);
    await waitFor(() => {
      expect((listen as Mock).mock.calls.some(([name]) => name === 'fs-changed')).toBe(true);
    });
  });

  it('reloads viewer when fs-changed file event arrives', async () => {
    (openDialog as Mock).mockResolvedValueOnce('/notes/x.md');
    render(<App />);

    const fileBtns = await screen.findAllByTitle(/file/i, { exact: false });
    const openFileBtn = fileBtns.find((b) => b.textContent?.toLowerCase().includes('file')) ?? fileBtns[1];
    await userEvent.click(openFileBtn);

    // Wait for viewer to mount and read the file initially
    await waitFor(() => {
      expect((readTextFile as Mock).mock.calls.length).toBeGreaterThan(0);
    });

    const initialReads = (readTextFile as Mock).mock.calls.length;
    (readTextFile as Mock).mockResolvedValueOnce('# Updated content');

    await act(async () => {
      fsChangedHandlers.forEach((h) => h({ payload: { kind: 'file', path: '/notes/x.md' } }));
    });

    await waitFor(() => {
      expect((readTextFile as Mock).mock.calls.length).toBeGreaterThan(initialReads);
    });
  });

  it('rescans file tree when fs-changed directory event arrives', async () => {
    (openDialog as Mock).mockResolvedValueOnce('/proj');
    render(<App />);
    const folderBtn = await screen.findByTitle(/folder/i, { exact: false });
    await userEvent.click(folderBtn);

    await waitFor(() => {
      expect((readDir as Mock).mock.calls.length).toBeGreaterThan(0);
    });

    const initialReadDirs = (readDir as Mock).mock.calls.length;

    await act(async () => {
      fsChangedHandlers.forEach((h) => h({ payload: { kind: 'directory', path: '/proj' } }));
    });

    await waitFor(() => {
      expect((readDir as Mock).mock.calls.length).toBeGreaterThan(initialReadDirs);
    });
  });
});
