const MARKDOWN_FILE_REGEX = /\.(md|markdown)$/i;

export function isMarkdownFile(path: string): boolean {
  return MARKDOWN_FILE_REGEX.test(path);
}

// Heuristic: path's basename has no dot → likely a folder.
// Used only for the sync "enter" event to decide whether to show the hint
// overlay. Has known false-negatives (.app bundles, `project.v2`, etc.)
// and false-positives (extensionless files like `Makefile`), so the "drop"
// handler must stat() paths rather than rely on this heuristic.
export function looksLikeFolder(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return false;
  const lastSlash = normalized.lastIndexOf("/");
  const base = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  if (!base) return false;
  return !base.includes(".");
}

export function getParentDir(path: string): string | null {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return null;
  if (normalized === "/") return "/";

  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return null;
  if (idx === 0) return "/";

  const parent = normalized.slice(0, idx);
  // Keep Windows drive roots normalized as "C:/" instead of "C:"
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}/`;
  return parent;
}

export type DroppedTarget =
  | { kind: "markdown"; path: string }
  | { kind: "maybe-folder"; path: string };

export function extractDroppedPaths(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const paths = (payload as { paths?: unknown }).paths;
  if (!Array.isArray(paths)) return [];
  return paths.filter((p): p is string => typeof p === "string");
}

export function findDroppedTarget(payload: unknown): DroppedTarget | null {
  const paths = extractDroppedPaths(payload);
  // Prefer markdown files when present
  for (const path of paths) {
    if (isMarkdownFile(path)) return { kind: "markdown", path };
  }
  // Fall back to folder-like paths (heuristic; stat() confirms on drop)
  for (const path of paths) {
    if (looksLikeFolder(path)) return { kind: "maybe-folder", path };
  }
  return null;
}

export function findDroppedMarkdownPath(payload: unknown): string | null {
  const target = findDroppedTarget(payload);
  return target && target.kind === "markdown" ? target.path : null;
}
