const MARKDOWN_FILE_REGEX = /\.(md|markdown)$/i;

export function isMarkdownFile(path: string): boolean {
  return MARKDOWN_FILE_REGEX.test(path);
}

// File extensions safe to hand to the OS default app without a confirmation
// prompt. Anything not listed (archives, unknown types, and — critically —
// executables) requires explicit user confirmation before opening, so a
// malicious document can't silently launch a file on one click. The Rust
// `open_path` command additionally hard-rejects executable types.
const PASSIVE_OPEN_EXTENSIONS = new Set([
  "pdf", "txt", "text", "csv", "tsv", "log", "rtf",
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "heic",
  "mp3", "wav", "ogg", "flac", "m4a",
  "mp4", "webm", "mov", "m4v",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "odt", "ods", "odp", "pages", "numbers", "key",
]);

/** Whether a local file may be opened with the OS default app without asking. */
export function isPassiveOpenTarget(path: string): boolean {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return false; // no extension (or dotfile) → confirm
  return PASSIVE_OPEN_EXTENSIONS.has(base.slice(dot + 1).toLowerCase());
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

/** decodeURIComponent that never throws on malformed input (e.g. a lone "%"). */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Resolve a relative link target (e.g. "./other.md", "../dir/x.md") against the
 * directory of the current file. Handles "." / ".." segments and infers the
 * path separator from `baseDir` so both POSIX ("/a/b") and Windows ("C:\\a\\b")
 * paths work. An already-absolute `relative` is returned unchanged.
 */
export function resolveRelativePath(baseDir: string, relative: string): string {
  // Already absolute (POSIX "/…" or Windows "C:\…" / "C:/…") → use as-is.
  if (relative.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relative)) {
    return relative;
  }
  const sep = baseDir.includes("\\") && !baseDir.includes("/") ? "\\" : "/";
  const parts = baseDir.split(/[\\/]/);
  for (const seg of relative.replace(/\\/g, "/").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length > 1) parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join(sep);
}

/** A classified Markdown link target, ready for the viewer to act on. */
export type LinkTarget =
  | { kind: "external"; url: string }
  | { kind: "anchor"; id: string }
  | { kind: "file"; path: string; anchor: string | null }
  | { kind: "open"; path: string };

/**
 * Classify an `<a href>` from rendered Markdown against the current file's
 * directory:
 *  - http(s)/mailto      → "external" (open in the OS browser/handler)
 *  - "#section"          → "anchor"   (scroll within the current document)
 *  - "./x.md", "x.md#s"  → "file"     (navigate in-app, optional anchor)
 *  - other local files   → "open"     (open with the OS default app)
 * A link that resolves to `currentPath` (the file being viewed) is treated as
 * an in-document anchor, not a navigation — re-selecting the same file is a
 * no-op that would otherwise swallow the jump. Returns null when there is
 * nothing actionable (empty href).
 */
export function classifyLink(
  baseDir: string,
  href: string,
  currentPath?: string,
  caseInsensitive = false,
): LinkTarget | null {
  if (!href) return null;
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
    return { kind: "external", url: href };
  }
  if (href.startsWith("#")) {
    return { kind: "anchor", id: safeDecode(href.slice(1)) };
  }
  const hashIdx = href.indexOf("#");
  const rawPath = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const anchor = hashIdx >= 0 ? safeDecode(href.slice(hashIdx + 1)) : null;
  if (!rawPath) return null;
  // Any other explicit URL scheme (file:, data:, javascript:, vscode:, …) is
  // not a relative path — ignore it rather than resolving it to a bogus local
  // path that would then be handed to the OS opener. Require 2+ scheme chars so
  // Windows drive letters ("C:\\dir\\file") aren't misread as a scheme.
  if (/^[a-z][a-z0-9+.-]+:/i.test(rawPath)) return null;
  const abs = resolveRelativePath(baseDir, safeDecode(rawPath));
  if (isMarkdownFile(abs)) {
    // Same document → scroll in place (empty id is a harmless no-op).
    // `caseInsensitive` lets the caller match by case on macOS/Windows (so a
    // "./README.md" link to "Readme.md" is the same file and doesn't reload),
    // while staying exact on case-sensitive filesystems (Linux) where those
    // are genuinely different files.
    if (currentPath && samePath(abs, currentPath, caseInsensitive)) {
      return { kind: "anchor", id: anchor ?? "" };
    }
    return { kind: "file", path: abs, anchor };
  }
  return { kind: "open", path: abs };
}

/** Whether two paths point at the same file. Separators are normalized; case
 *  is folded only when `caseInsensitive` is set (macOS/Windows filesystems). */
function samePath(a: string, b: string, caseInsensitive: boolean): boolean {
  const norm = (p: string) => {
    const s = p.replace(/\\/g, "/");
    return caseInsensitive ? s.toLowerCase() : s;
  };
  return norm(a) === norm(b);
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
