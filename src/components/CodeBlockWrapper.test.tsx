import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithLocale } from "../test/helpers";
import { CodeBlockWrapper } from "./CodeBlockWrapper";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CodeBlockWrapper", () => {
  it("renders children inside a pre element", () => {
    renderWithLocale(
      <CodeBlockWrapper>
        <code>console.log("hello")</code>
      </CodeBlockWrapper>
    );
    expect(screen.getByText('console.log("hello")')).toBeInTheDocument();
  });

  it("shows copy button on hover", () => {
    renderWithLocale(
      <CodeBlockWrapper>
        <code>test code</code>
      </CodeBlockWrapper>
    );
    const btn = screen.getByRole("button", { name: "Copy code" });
    expect(btn).toBeInTheDocument();
  });

  it("copies code to clipboard on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithLocale(
      <CodeBlockWrapper>
        <code>const x = 1;</code>
      </CodeBlockWrapper>
    );

    const btn = screen.getByRole("button", { name: "Copy code" });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(writeText).toHaveBeenCalledWith("const x = 1;");
  });

  it("shows check mark after copy and resets after 2s", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithLocale(
      <CodeBlockWrapper>
        <code>hello</code>
      </CodeBlockWrapper>
    );

    const btn = screen.getByRole("button", { name: "Copy code" });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  });

  it("does not show copy button for mermaid blocks", () => {
    renderWithLocale(
      <CodeBlockWrapper>
        <code>
          <div className="mermaid-container">diagram</div>
        </code>
      </CodeBlockWrapper>
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
