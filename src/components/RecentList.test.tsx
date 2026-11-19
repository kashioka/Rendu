import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithLocale } from "../test/helpers";
import { stat } from "@tauri-apps/plugin-fs";
import type { Mock } from "vitest";
import { RecentList } from "./RecentList";

vi.mock("@tauri-apps/plugin-fs", () => ({
  stat: vi.fn().mockResolvedValue({ isFile: true }),
}));

const mockOnOpenFile = vi.fn();
const mockOnOpenFolder = vi.fn();
const mockOnRemove = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecentList", () => {
  it("renders nothing when entries are empty", () => {
    const { container } = renderWithLocale(
      <RecentList entries={[]} onOpenFile={mockOnOpenFile} onOpenFolder={mockOnOpenFolder} onRemove={mockOnRemove} />
    );
    expect(container.querySelector(".recent-list")).not.toBeInTheDocument();
  });

  it("renders entries with file names", () => {
    const entries = [
      { path: "/home/user/readme.md", type: "file" as const, timestamp: 1000 },
      { path: "/projects/docs", type: "folder" as const, timestamp: 900 },
    ];
    renderWithLocale(
      <RecentList entries={entries} onOpenFile={mockOnOpenFile} onOpenFolder={mockOnOpenFolder} onRemove={mockOnRemove} />
    );
    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("Recent")).toBeInTheDocument();
  });

  it("calls onOpenFile for file entries on click", async () => {
    const entries = [
      { path: "/home/user/readme.md", type: "file" as const, timestamp: 1000 },
    ];
    renderWithLocale(
      <RecentList entries={entries} onOpenFile={mockOnOpenFile} onOpenFolder={mockOnOpenFolder} onRemove={mockOnRemove} />
    );

    await act(async () => {
      fireEvent.click(screen.getByText("readme.md"));
    });

    expect(mockOnOpenFile).toHaveBeenCalledWith("/home/user/readme.md");
  });

  it("removes the entry when the path no longer exists", async () => {
    (stat as Mock).mockRejectedValueOnce(new Error("No such file or directory (os error 2)"));
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const entries = [{ path: "/home/user/gone.md", type: "file" as const, timestamp: 1000 }];
    renderWithLocale(
      <RecentList entries={entries} onOpenFile={mockOnOpenFile} onOpenFolder={mockOnOpenFolder} onRemove={mockOnRemove} />
    );

    await act(async () => {
      fireEvent.click(screen.getByText("gone.md"));
    });

    expect(mockOnRemove).toHaveBeenCalledWith("/home/user/gone.md");
    expect(alertSpy).toHaveBeenCalledWith("This file or folder no longer exists.");
    alertSpy.mockRestore();
  });

  // Issue #221: v0.11.3 reported a forbidden path as "no longer exists" and
  // dropped it from Recent.
  it("keeps the entry and explains access when the path is outside the fs scope", async () => {
    (stat as Mock).mockRejectedValueOnce("forbidden path: /Volumes/USB/notes.md");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const entries = [{ path: "/Volumes/USB/notes.md", type: "file" as const, timestamp: 1000 }];
    renderWithLocale(
      <RecentList entries={entries} onOpenFile={mockOnOpenFile} onOpenFolder={mockOnOpenFolder} onRemove={mockOnRemove} />
    );

    await act(async () => {
      fireEvent.click(screen.getByText("notes.md"));
    });

    expect(mockOnRemove).not.toHaveBeenCalled();
    expect(mockOnOpenFile).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Open this one again"));
    alertSpy.mockRestore();
  });

  it("calls onRemove when remove button is clicked", () => {
    const entries = [
      { path: "/home/user/readme.md", type: "file" as const, timestamp: 1000 },
    ];
    renderWithLocale(
      <RecentList entries={entries} onOpenFile={mockOnOpenFile} onOpenFolder={mockOnOpenFolder} onRemove={mockOnRemove} />
    );

    const removeBtn = screen.getByRole("button", { name: "Remove from recent" });
    fireEvent.click(removeBtn);

    expect(mockOnRemove).toHaveBeenCalledWith("/home/user/readme.md");
  });
});
