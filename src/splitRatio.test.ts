import { describe, it, expect } from "vitest";
import { splitRatioFromPointer, MIN_SPLIT_RATIO, MAX_SPLIT_RATIO } from "./splitRatio";

describe("splitRatioFromPointer", () => {
  // Container at y=100, 524px tall, 24px divider → 500px shared by the panes.
  const top = 100;
  const height = 524;
  const divider = 24;

  it("puts the divider center under the pointer", () => {
    // 250px of tree above the divider → divider center at 100 + 250 + 12.
    expect(splitRatioFromPointer(362, top, height, divider)).toBeCloseTo(0.5);
    expect(splitRatioFromPointer(100 + 100 + 12, top, height, divider)).toBeCloseTo(0.2);
  });

  it("does not depend on content above the container (header, folder path)", () => {
    // Same pointer offset within the container, container moved down by 80px.
    expect(splitRatioFromPointer(362 + 80, top + 80, height, divider)).toBeCloseTo(0.5);
  });

  it("clamps to the allowed range", () => {
    expect(splitRatioFromPointer(0, top, height, divider)).toBe(MIN_SPLIT_RATIO);
    expect(splitRatioFromPointer(10_000, top, height, divider)).toBe(MAX_SPLIT_RATIO);
  });
});
