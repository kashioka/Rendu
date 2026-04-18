import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithLocale } from "../test/helpers";
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
