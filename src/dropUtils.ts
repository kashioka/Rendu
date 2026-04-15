const MARKDOWN_FILE_REGEX = /\.(md|markdown)$/i;

export function isMarkdownFile(path: string): boolean {
  return MARKDOWN_FILE_REGEX.test(path);
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

export function findDroppedMarkdownPath(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const paths = (payload as { paths?: unknown }).paths;
  if (!Array.isArray(paths)) return null;
  for (const path of paths) {
    if (typeof path === "string" && isMarkdownFile(path)) return path;
  }
  return null;
}
