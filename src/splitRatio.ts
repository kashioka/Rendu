// Vertical split between the file tree and the outline in the sidebar.
// The ratio is the file tree's share of the height left after the divider.
export const MIN_SPLIT_RATIO = 0.15;
export const MAX_SPLIT_RATIO = 0.85;

/**
 * Ratio for a divider drag, measured against the element that holds both
 * panes and the divider (not the whole sidebar), so the header and folder
 * path above it never skew the result. The pointer is treated as the
 * divider's center.
 */
export function splitRatioFromPointer(
  clientY: number,
  containerTop: number,
  containerHeight: number,
  dividerHeight: number,
): number {
  const ratio = (clientY - containerTop - dividerHeight / 2) / (containerHeight - dividerHeight);
  return Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio));
}
