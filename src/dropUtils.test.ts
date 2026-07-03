import { describe, it, expect } from 'vitest';
import {
  isMarkdownFile,
  getParentDir,
  findDroppedMarkdownPath,
  looksLikeFolder,
  findDroppedTarget,
  extractDroppedPaths,
  resolveRelativePath,
  classifyLink,
} from './dropUtils';

describe('isMarkdownFile', () => {
  it('accepts .md extension', () => {
    expect(isMarkdownFile('/docs/README.md')).toBe(true);
  });

  it('accepts .markdown extension', () => {
    expect(isMarkdownFile('/docs/notes.markdown')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isMarkdownFile('FILE.MD')).toBe(true);
    expect(isMarkdownFile('file.Markdown')).toBe(true);
  });

  it('rejects non-markdown extensions', () => {
    expect(isMarkdownFile('image.png')).toBe(false);
    expect(isMarkdownFile('style.css')).toBe(false);
    expect(isMarkdownFile('app.tsx')).toBe(false);
  });

  it('rejects files with md-like but invalid extensions', () => {
    expect(isMarkdownFile('data.mdx')).toBe(false);
    expect(isMarkdownFile('file.md.bak')).toBe(false);
  });

  it('rejects paths without extension', () => {
    expect(isMarkdownFile('README')).toBe(false);
    expect(isMarkdownFile('/path/to/md')).toBe(false);
  });
});

describe('getParentDir', () => {
  it('returns parent for a Unix file path', () => {
    expect(getParentDir('/home/user/docs/README.md')).toBe('/home/user/docs');
  });

  it('returns root for a file in root directory', () => {
    expect(getParentDir('/README.md')).toBe('/');
  });

  it('returns null when path is "/" (no parent above root)', () => {
    // "/" normalizes to "" after trailing-slash removal, so returns null
    expect(getParentDir('/')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(getParentDir('')).toBe(null);
  });

  it('returns null for a bare filename without separator', () => {
    expect(getParentDir('README.md')).toBe(null);
  });

  it('strips trailing slashes before resolving', () => {
    expect(getParentDir('/home/user/docs/')).toBe('/home/user');
  });

  it('handles Windows backslash paths', () => {
    expect(getParentDir('C:\\Users\\kato\\docs\\file.md')).toBe('C:/Users/kato/docs');
  });

  it('normalizes Windows drive root as "C:/"', () => {
    expect(getParentDir('C:\\file.md')).toBe('C:/');
  });

  it('handles mixed separators', () => {
    expect(getParentDir('C:\\Users/docs\\file.md')).toBe('C:/Users/docs');
  });
});

describe('findDroppedMarkdownPath', () => {
  it('returns the first markdown path from payload', () => {
    const payload = { paths: ['/docs/README.md'] };
    expect(findDroppedMarkdownPath(payload)).toBe('/docs/README.md');
  });

  it('skips non-markdown files and returns the first markdown match', () => {
    const payload = { paths: ['/img/photo.png', '/docs/notes.md', '/docs/other.md'] };
    expect(findDroppedMarkdownPath(payload)).toBe('/docs/notes.md');
  });

  it('returns null when no markdown files are present', () => {
    const payload = { paths: ['/img/photo.png', '/style.css'] };
    expect(findDroppedMarkdownPath(payload)).toBe(null);
  });

  it('returns null for empty paths array', () => {
    expect(findDroppedMarkdownPath({ paths: [] })).toBe(null);
  });

  it('returns null for null payload', () => {
    expect(findDroppedMarkdownPath(null)).toBe(null);
  });

  it('returns null for undefined payload', () => {
    expect(findDroppedMarkdownPath(undefined)).toBe(null);
  });

  it('returns null when payload is not an object', () => {
    expect(findDroppedMarkdownPath('string')).toBe(null);
    expect(findDroppedMarkdownPath(42)).toBe(null);
  });

  it('returns null when paths is not an array', () => {
    expect(findDroppedMarkdownPath({ paths: 'not-array' })).toBe(null);
    expect(findDroppedMarkdownPath({})).toBe(null);
  });

  it('skips non-string entries in paths array', () => {
    const payload = { paths: [123, null, '/docs/file.md'] };
    expect(findDroppedMarkdownPath(payload)).toBe('/docs/file.md');
  });
});

describe('looksLikeFolder', () => {
  it('returns true for paths whose basename has no dot', () => {
    expect(looksLikeFolder('/home/user/docs')).toBe(true);
    expect(looksLikeFolder('/home/user/my-project')).toBe(true);
  });

  it('returns false for paths that look like files with extensions', () => {
    expect(looksLikeFolder('/home/user/README.md')).toBe(false);
    expect(looksLikeFolder('/home/user/photo.png')).toBe(false);
  });

  it('strips trailing slashes before evaluating', () => {
    expect(looksLikeFolder('/home/user/docs/')).toBe(true);
  });

  it('handles Windows backslash paths', () => {
    expect(looksLikeFolder('C:\\Users\\kato\\docs')).toBe(true);
    expect(looksLikeFolder('C:\\Users\\kato\\file.md')).toBe(false);
  });

  it('returns false for empty or root-only paths', () => {
    expect(looksLikeFolder('')).toBe(false);
    expect(looksLikeFolder('/')).toBe(false);
  });

  it('treats dotted folders as files (heuristic limitation)', () => {
    // This is a known false-negative; stat() catches it at drop time
    expect(looksLikeFolder('/Applications/Safari.app')).toBe(false);
  });
});

describe('extractDroppedPaths', () => {
  it('returns string paths from payload', () => {
    expect(extractDroppedPaths({ paths: ['/a', '/b'] })).toEqual(['/a', '/b']);
  });

  it('filters out non-string entries', () => {
    expect(extractDroppedPaths({ paths: ['/a', 1, null, undefined, '/b'] })).toEqual([
      '/a',
      '/b',
    ]);
  });

  it('returns empty array for invalid payloads', () => {
    expect(extractDroppedPaths(null)).toEqual([]);
    expect(extractDroppedPaths(undefined)).toEqual([]);
    expect(extractDroppedPaths({})).toEqual([]);
    expect(extractDroppedPaths({ paths: 'not-array' })).toEqual([]);
    expect(extractDroppedPaths('string')).toEqual([]);
  });
});

describe('findDroppedTarget', () => {
  it('returns a markdown target when a .md file is present', () => {
    const payload = { paths: ['/docs/README.md'] };
    expect(findDroppedTarget(payload)).toEqual({
      kind: 'markdown',
      path: '/docs/README.md',
    });
  });

  it('prefers markdown over folder when both are present', () => {
    const payload = { paths: ['/home/user/project', '/docs/notes.md'] };
    expect(findDroppedTarget(payload)).toEqual({
      kind: 'markdown',
      path: '/docs/notes.md',
    });
  });

  it('returns a maybe-folder target when only folder-like paths exist', () => {
    const payload = { paths: ['/home/user/project'] };
    expect(findDroppedTarget(payload)).toEqual({
      kind: 'maybe-folder',
      path: '/home/user/project',
    });
  });

  it('returns null when only non-markdown files are present', () => {
    const payload = { paths: ['/img/photo.png', '/style.css'] };
    expect(findDroppedTarget(payload)).toBe(null);
  });

  it('returns null for empty or invalid payloads', () => {
    expect(findDroppedTarget(null)).toBe(null);
    expect(findDroppedTarget(undefined)).toBe(null);
    expect(findDroppedTarget({})).toBe(null);
    expect(findDroppedTarget({ paths: [] })).toBe(null);
    expect(findDroppedTarget({ paths: 'not-array' })).toBe(null);
  });
});

describe('resolveRelativePath', () => {
  it('resolves "./sibling" against the file directory', () => {
    expect(resolveRelativePath('/docs/ja/detailed', './QR_Code_Specification.md'))
      .toBe('/docs/ja/detailed/QR_Code_Specification.md');
  });

  it('resolves a bare relative path (no "./")', () => {
    expect(resolveRelativePath('/docs', 'guide.md')).toBe('/docs/guide.md');
  });

  it('resolves "../" parent segments', () => {
    expect(resolveRelativePath('/docs/ja/detailed', '../overview.md'))
      .toBe('/docs/ja/overview.md');
    expect(resolveRelativePath('/docs/ja/detailed', '../../top.md'))
      .toBe('/docs/top.md');
  });

  it('does not pop past the root', () => {
    expect(resolveRelativePath('/a', '../../../x.md')).toBe('/x.md');
  });

  it('preserves Windows separators and drive roots', () => {
    expect(resolveRelativePath('C:\\Users\\me\\docs', './a.md'))
      .toBe('C:\\Users\\me\\docs\\a.md');
    expect(resolveRelativePath('C:\\Users\\me\\docs', '../b.md'))
      .toBe('C:\\Users\\me\\b.md');
  });

  it('returns an already-absolute target unchanged', () => {
    expect(resolveRelativePath('/docs', '/etc/passwd.md')).toBe('/etc/passwd.md');
    expect(resolveRelativePath('/docs', 'C:\\x\\y.md')).toBe('C:\\x\\y.md');
  });

  it('decodes percent-encoding in the path (via classifyLink)', () => {
    // resolveRelativePath itself does not decode; classifyLink does. Verified there.
    expect(resolveRelativePath('/docs', 'My%20Doc.md')).toBe('/docs/My%20Doc.md');
  });
});

describe('classifyLink', () => {
  const base = '/docs/ja/detailed';

  it('classifies http(s) and mailto as external', () => {
    expect(classifyLink(base, 'https://example.com')).toEqual({ kind: 'external', url: 'https://example.com' });
    expect(classifyLink(base, 'http://example.com/a')).toEqual({ kind: 'external', url: 'http://example.com/a' });
    expect(classifyLink(base, 'mailto:a@b.com')).toEqual({ kind: 'external', url: 'mailto:a@b.com' });
  });

  it('classifies "#fragment" as an in-document anchor', () => {
    expect(classifyLink(base, '#section-1')).toEqual({ kind: 'anchor', id: 'section-1' });
  });

  it('classifies a relative .md link as an in-app file navigation', () => {
    expect(classifyLink(base, './QR_Code_Specification.md')).toEqual({
      kind: 'file',
      path: '/docs/ja/detailed/QR_Code_Specification.md',
      anchor: null,
    });
  });

  it('splits a path#anchor link into file + anchor', () => {
    expect(classifyLink(base, '../overview.md#intro')).toEqual({
      kind: 'file',
      path: '/docs/ja/overview.md',
      anchor: 'intro',
    });
  });

  it('decodes percent-encoded paths and anchors', () => {
    expect(classifyLink(base, './My%20Doc.md#%E8%A6%8B%E5%87%BA%E3%81%97')).toEqual({
      kind: 'file',
      path: '/docs/ja/detailed/My Doc.md',
      anchor: '見出し',
    });
  });

  it('classifies a non-Markdown local file as "open" (OS default app)', () => {
    expect(classifyLink(base, './diagram.pdf')).toEqual({ kind: 'open', path: '/docs/ja/detailed/diagram.pdf' });
    expect(classifyLink(base, '../img/photo.png')).toEqual({ kind: 'open', path: '/docs/ja/img/photo.png' });
  });

  it('returns null for an empty href', () => {
    expect(classifyLink(base, '')).toBe(null);
  });

  it('treats a link to the current file as an in-document anchor', () => {
    const current = '/docs/ja/detailed/current.md';
    // "./current.md#bar" while viewing current.md → anchor, not a no-op navigation
    expect(classifyLink(base, './current.md#bar', current)).toEqual({ kind: 'anchor', id: 'bar' });
    // same file, no fragment → harmless empty-id anchor (no navigation)
    expect(classifyLink(base, './current.md', current)).toEqual({ kind: 'anchor', id: '' });
    // a DIFFERENT file in the same dir is still a navigation
    expect(classifyLink(base, './other.md#bar', current)).toEqual({
      kind: 'file',
      path: '/docs/ja/detailed/other.md',
      anchor: 'bar',
    });
  });

  it('matches the current file case-insensitively when the FS is (macOS/Windows)', () => {
    const current = '/docs/Readme.md';
    // caseInsensitive=true: differently-cased link to the same file → anchor, no reload
    expect(classifyLink('/docs', './README.md#top', current, true)).toEqual({ kind: 'anchor', id: 'top' });
  });

  it('keeps differently-cased links as distinct files on a case-sensitive FS (Linux)', () => {
    const current = '/docs/Readme.md';
    // caseInsensitive=false (default): README.md and Readme.md are different files → navigate
    expect(classifyLink('/docs', './README.md#top', current)).toEqual({
      kind: 'file',
      path: '/docs/README.md',
      anchor: 'top',
    });
  });
});
