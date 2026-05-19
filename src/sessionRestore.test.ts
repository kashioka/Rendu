import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSession, restoreOnStartup, saveSession } from "./sessionRestore";

beforeEach(() => {
  sessionStorage.clear();
});

describe("saveSession / loadSession", () => {
  it("returns nulls when storage is empty", () => {
    expect(loadSession()).toEqual({ rootDir: null, selectedFile: null });
  });

  it("round-trips selectedFile and rootDir", () => {
    saveSession({ rootDir: "/work", selectedFile: "/work/a.md" });
    expect(loadSession()).toEqual({
      rootDir: "/work",
      selectedFile: "/work/a.md",
    });
  });

  it("persists folder-only state (no selectedFile)", () => {
    saveSession({ rootDir: "/work", selectedFile: null });
    expect(loadSession()).toEqual({
      rootDir: "/work",
      selectedFile: null,
    });
  });

  it("clears keys when values become null", () => {
    saveSession({ rootDir: "/work", selectedFile: "/work/a.md" });
    saveSession({ rootDir: null, selectedFile: null });
    expect(sessionStorage.getItem("rendu:lastFile")).toBeNull();
    expect(sessionStorage.getItem("rendu:lastRootDir")).toBeNull();
    expect(loadSession()).toEqual({ rootDir: null, selectedFile: null });
  });

  it("uses keys 'rendu:lastFile' and 'rendu:lastRootDir'", () => {
    saveSession({ rootDir: "/r", selectedFile: "/r/x.md" });
    expect(sessionStorage.getItem("rendu:lastFile")).toBe("/r/x.md");
    expect(sessionStorage.getItem("rendu:lastRootDir")).toBe("/r");
  });
});

describe("restoreOnStartup", () => {
  function makeDeps(initial: string | null) {
    return {
      getInitialFile: vi.fn().mockResolvedValue(initial),
      openFile: vi.fn(),
      openFolder: vi.fn(),
    };
  }

  it("opens get_initial_file even when session has a file (CLI wins)", async () => {
    saveSession({ rootDir: "/work", selectedFile: "/work/old.md" });
    const deps = makeDeps("/cli/arg.md");
    await restoreOnStartup(deps);
    expect(deps.openFile).toHaveBeenCalledExactlyOnceWith("/cli/arg.md");
    expect(deps.openFolder).not.toHaveBeenCalled();
  });

  it("opens get_initial_file even when session has only a folder (CLI wins)", async () => {
    saveSession({ rootDir: "/work", selectedFile: null });
    const deps = makeDeps("/cli/arg.md");
    await restoreOnStartup(deps);
    expect(deps.openFile).toHaveBeenCalledExactlyOnceWith("/cli/arg.md");
    expect(deps.openFolder).not.toHaveBeenCalled();
  });

  it("falls back to session file when no initial file", async () => {
    saveSession({ rootDir: "/work", selectedFile: "/work/a.md" });
    const deps = makeDeps(null);
    await restoreOnStartup(deps);
    expect(deps.openFile).toHaveBeenCalledExactlyOnceWith("/work/a.md");
    expect(deps.openFolder).not.toHaveBeenCalled();
  });

  it("falls back to session folder when no initial file and no session file", async () => {
    saveSession({ rootDir: "/work", selectedFile: null });
    const deps = makeDeps(null);
    await restoreOnStartup(deps);
    expect(deps.openFolder).toHaveBeenCalledExactlyOnceWith("/work");
    expect(deps.openFile).not.toHaveBeenCalled();
  });

  it("does nothing when nothing is set", async () => {
    const deps = makeDeps(null);
    await restoreOnStartup(deps);
    expect(deps.openFile).not.toHaveBeenCalled();
    expect(deps.openFolder).not.toHaveBeenCalled();
  });

  it("treats a rejected get_initial_file as null and still attempts session restore", async () => {
    saveSession({ rootDir: "/work", selectedFile: "/work/a.md" });
    const deps = {
      getInitialFile: vi.fn().mockRejectedValue(new Error("ipc")),
      openFile: vi.fn(),
      openFolder: vi.fn(),
    };
    await restoreOnStartup(deps);
    expect(deps.openFile).toHaveBeenCalledExactlyOnceWith("/work/a.md");
  });

  it("end-to-end: a saved session is restored on a fresh restoreOnStartup call (reload scenario)", async () => {
    // Simulate the user having opened a file before the reload.
    saveSession({ rootDir: "/proj", selectedFile: "/proj/README.md" });

    // After reload: get_initial_file returns null (no CLI arg, no file
    // association). restoreOnStartup should reopen the saved file.
    const deps = makeDeps(null);
    await restoreOnStartup(deps);

    expect(deps.openFile).toHaveBeenCalledExactlyOnceWith("/proj/README.md");
  });
});
