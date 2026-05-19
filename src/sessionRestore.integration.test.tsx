// Integration test for the save-after-restore timing contract in App.tsx.
// Regression guard for the bug Codex caught during review: the save effect
// must not wipe sessionStorage before the restore effect has read it.
// We replicate the exact useEffect pattern from App.tsx in a small harness
// so the test exercises real React scheduling without dragging in the
// full AppInner component (and its many sub-component dependencies).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { restoreOnStartup, saveSession } from "./sessionRestore";

beforeEach(() => {
  sessionStorage.clear();
});

// Mirrors the App.tsx logic for restore + save. Kept in sync intentionally.
function Harness({
  getInitialFile,
}: {
  getInitialFile: () => Promise<string | null>;
}) {
  const [rootDir, setRootDir] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    restoreOnStartup({
      getInitialFile,
      openFile: (p) => {
        // Match handleDropFile semantics: derives rootDir from parent.
        setSelectedFile(p);
        setRootDir(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : null);
      },
      openFolder: (p) => {
        setRootDir(p);
        setSelectedFile(null);
      },
    }).finally(() => {
      restoredRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restoredRef.current) return;
    saveSession({ rootDir, selectedFile });
  }, [rootDir, selectedFile]);

  return (
    <div>
      <span data-testid="file">{selectedFile ?? ""}</span>
      <span data-testid="root">{rootDir ?? ""}</span>
    </div>
  );
}

describe("App save/restore timing", () => {
  it("restores a previously saved file after reload (Issue #59)", async () => {
    saveSession({ rootDir: "/proj", selectedFile: "/proj/README.md" });

    const { getByTestId } = render(
      <Harness getInitialFile={() => Promise.resolve(null)} />,
    );

    // Let microtasks settle so the async restore completes.
    await act(async () => {});

    expect(getByTestId("file").textContent).toBe("/proj/README.md");
    // sessionStorage should still hold the value (and possibly re-saved after
    // restore, but never wiped).
    expect(sessionStorage.getItem("rendu:lastFile")).toBe("/proj/README.md");
  });

  it("does NOT wipe sessionStorage before restore completes", async () => {
    // This is the exact bug Codex caught: if the save effect runs on the
    // initial (null, null) render, it clears the saved entry before the
    // async restore effect reads it.
    saveSession({ rootDir: "/proj", selectedFile: "/proj/a.md" });

    // Slow get_initial_file so we have a window where state is still null
    // but the save effect could run on first commit.
    let resolveInitial: (value: string | null) => void = () => {};
    const slowInitial = new Promise<string | null>((res) => {
      resolveInitial = res;
    });

    render(<Harness getInitialFile={() => slowInitial} />);

    // Storage must still hold the saved entry after the first React commit.
    expect(sessionStorage.getItem("rendu:lastFile")).toBe("/proj/a.md");

    await act(async () => {
      resolveInitial(null);
    });

    expect(sessionStorage.getItem("rendu:lastFile")).toBe("/proj/a.md");
  });

  it("CLI / file association wins over session", async () => {
    saveSession({ rootDir: "/proj", selectedFile: "/proj/old.md" });

    const { getByTestId } = render(
      <Harness getInitialFile={() => Promise.resolve("/cli/arg.md")} />,
    );

    await act(async () => {});

    expect(getByTestId("file").textContent).toBe("/cli/arg.md");
  });

  it("no session and no initial file → empty state", async () => {
    const getInitialFile = vi.fn().mockResolvedValue(null);

    const { getByTestId } = render(<Harness getInitialFile={getInitialFile} />);

    await act(async () => {});

    expect(getByTestId("file").textContent).toBe("");
    expect(getByTestId("root").textContent).toBe("");
    // Save effect must not have fired (deps unchanged), so no spurious writes.
    expect(sessionStorage.getItem("rendu:lastFile")).toBeNull();
    expect(sessionStorage.getItem("rendu:lastRootDir")).toBeNull();
  });
});
