import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@tauri-apps/api/path", () => ({
  appConfigDir: vi.fn().mockResolvedValue("/mock/config"),
}));

const mockExists = vi.fn().mockResolvedValue(false);
const mockReadTextFile = vi.fn().mockResolvedValue("[]");
const mockWriteTextFile = vi.fn().mockResolvedValue(undefined);
const mockMkdir = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  readTextFile: (...args: unknown[]) => mockReadTextFile(...args),
  writeTextFile: (...args: unknown[]) => mockWriteTextFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

import { useRecentFiles } from "./useRecentFiles";

beforeEach(() => {
  vi.clearAllMocks();
  mockExists.mockResolvedValue(false);
});

describe("useRecentFiles", () => {
  it("starts with empty entries", async () => {
    const { result } = renderHook(() => useRecentFiles());
    await act(async () => {});
    expect(result.current.entries).toEqual([]);
  });

  it("loads saved entries from file", async () => {
    const saved = [
      { path: "/foo/bar.md", type: "file", timestamp: 1000 },
    ];
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(JSON.stringify(saved));

    const { result } = renderHook(() => useRecentFiles());
    await act(async () => {});

    expect(result.current.entries).toEqual(saved);
  });

  it("addRecent prepends and deduplicates", async () => {
    const { result } = renderHook(() => useRecentFiles());
    await act(async () => {});

    act(() => result.current.addRecent("/a.md", "file"));
    act(() => result.current.addRecent("/b.md", "file"));
    act(() => result.current.addRecent("/a.md", "file"));

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].path).toBe("/a.md");
    expect(result.current.entries[1].path).toBe("/b.md");
  });

  it("limits to 10 entries", async () => {
    const { result } = renderHook(() => useRecentFiles());
    await act(async () => {});

    for (let i = 0; i < 12; i++) {
      act(() => result.current.addRecent(`/file${i}.md`, "file"));
    }

    expect(result.current.entries).toHaveLength(10);
    expect(result.current.entries[0].path).toBe("/file11.md");
  });

  it("removeRecent removes the entry", async () => {
    const { result } = renderHook(() => useRecentFiles());
    await act(async () => {});

    act(() => result.current.addRecent("/a.md", "file"));
    act(() => result.current.addRecent("/b.md", "file"));
    act(() => result.current.removeRecent("/a.md"));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].path).toBe("/b.md");
  });
});
