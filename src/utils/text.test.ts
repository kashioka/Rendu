import { describe, it, expect } from "vitest";
import { normalizeForSearch, truncateChars } from "./text";

describe("normalizeForSearch", () => {
  it("lowercases ASCII", () => {
    expect(normalizeForSearch("Hello")).toBe("hello");
  });

  it("folds full-width latin to half-width (ＡＢＣ -> abc)", () => {
    expect(normalizeForSearch("ＡＢＣ")).toBe("abc");
  });

  it("folds half-width katakana to full-width (ｶﾅ -> カナ)", () => {
    expect(normalizeForSearch("ｶﾅ")).toBe(normalizeForSearch("カナ"));
  });

  it("makes a full-width query match half-width content", () => {
    const content = normalizeForSearch("It costs 5 USD");
    const query = normalizeForSearch("５"); // full-width 5
    expect(content.includes(query)).toBe(true);
  });

  it("leaves CJK unchanged (toLowerCase is a no-op)", () => {
    expect(normalizeForSearch("日本語")).toBe("日本語");
  });
});

describe("truncateChars", () => {
  it("returns the string unchanged when within max", () => {
    expect(truncateChars("hello", 80)).toBe("hello");
  });

  it("truncates and appends ellipsis when over max", () => {
    expect(truncateChars("abcdef", 3)).toBe("abc…");
  });

  it("counts CJK characters individually", () => {
    expect(truncateChars("あいうえお", 3)).toBe("あいう…");
  });

  it("returns unchanged at exactly max code points (no ellipsis)", () => {
    expect(truncateChars("abc", 3)).toBe("abc");
  });

  it("handles empty string", () => {
    expect(truncateChars("", 5)).toBe("");
  });

  it("does not split surrogate pairs (emoji)", () => {
    // 4 emoji, each a surrogate pair (2 UTF-16 units). slice(0,3) on units would
    // split the 2nd emoji into a broken half; truncateChars must keep whole ones.
    const result = truncateChars("😀😁😂😃", 2);
    expect(result).toBe("😀😁…");
    expect(result).not.toContain("�");
    expect(Array.from(result.replace("…", ""))).toHaveLength(2);
  });
});
