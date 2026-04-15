import { describe, it, expect } from 'vitest';
import { isMarkdownFile, getParentDir, findDroppedMarkdownPath } from './dropUtils';

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
