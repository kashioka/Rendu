import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@tauri-apps/api/path", () => ({
  appConfigDir: vi.fn().mockResolvedValue("/mock/config"),
}));

const mockExists = vi.fn().mockResolvedValue(false);
const mockReadTextFile = vi.fn().mockResolvedValue("[]");
const mockInvoke = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  readTextFile: (...args: unknown[]) => mockReadTextFile(...args),
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

  it("keeps entries added before the saved list finishes loading", async () => {
    const saved = [
      { path: "/foo/old.md", type: "file", timestamp: 1000 },
      { path: "/foo/startup.md", type: "file", timestamp: 900 },
    ];
    mockExists.mockResolvedValue(true);
    let resolveRead: (text: string) => void = () => {};
    mockReadTextFile.mockReturnValue(new Promise<string>((r) => { resolveRead = r; }));

    const { result } = renderHook(() => useRecentFiles());
    // Startup file opened via file association before recent.json is read.
    act(() => result.current.addRecent("/foo/startup.md", "file"));
    await act(async () => { resolveRead(JSON.stringify(saved)); });

    expect(result.current.entries.map((e) => e.path)).toEqual(["/foo/startup.md", "/foo/old.md"]);
  });

  // The webview has no fs write permission; Rust picks the path from the name.
  it("saves through atomic_write by file name", async () => {
    const { result } = renderHook(() => useRecentFiles());
    await act(async () => {});
    await act(async () => { result.current.addRecent("/foo/a.md", "file"); });

    const call = mockInvoke.mock.calls.filter(([cmd]) => cmd === "atomic_write").at(-1);
    expect(call?.[1]).toMatchObject({ name: "recent.json" });
    expect(JSON.parse((call?.[1] as { contents: string }).contents)[0].path).toBe("/foo/a.md");
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
