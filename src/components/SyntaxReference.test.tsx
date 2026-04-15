import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithLocale } from "../test/helpers";
import { SyntaxReference } from "./SyntaxReference";

describe("SyntaxReference", () => {
  it("renders the title", () => {
    renderWithLocale(<SyntaxReference />);
    expect(screen.getByText("Supported Syntax")).toBeInTheDocument();
  });

  it("renders all section headings", () => {
    renderWithLocale(<SyntaxReference />);
    expect(screen.getByText("Formatting")).toBeInTheDocument();
    expect(screen.getByText("Headings")).toBeInTheDocument();
    expect(screen.getByText("Lists")).toBeInTheDocument();
    expect(screen.getByText("Blocks")).toBeInTheDocument();
    expect(screen.getByText("HTML")).toBeInTheDocument();
    expect(screen.getByText("Mermaid")).toBeInTheDocument();
  });

  it("renders translated content in Japanese locale", () => {
    renderWithLocale(<SyntaxReference />, { locale: "ja" });
    expect(screen.getByText("対応している記法")).toBeInTheDocument();
    expect(screen.getByText("書式")).toBeInTheDocument();
    expect(screen.getByText("見出し")).toBeInTheDocument();
    expect(screen.getByText("リスト")).toBeInTheDocument();
    expect(screen.getByText("ブロック")).toBeInTheDocument();
    expect(screen.getByText("リンク")).toBeInTheDocument();
  });

  it("renders footer text", () => {
    renderWithLocale(<SyntaxReference />);
    expect(
      screen.getByText("GitHub Flavored Markdown (GFM) + HTML")
    ).toBeInTheDocument();
  });
});
