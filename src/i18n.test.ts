import { describe, it, expect } from 'vitest';
import { getTranslations } from './i18n';

describe('i18n', () => {
  const en = getTranslations('en');
  const ja = getTranslations('ja');
  const zhCN = getTranslations('zh-CN');

  it('returns English translations with correct values', () => {
    expect(en['sidebar.folder']).toBe('Folder');
    expect(en['viewer.loading']).toBe('Loading...');
    expect(en['viewer.exportPdf']).toBe('Export PDF');
  });

  it('returns Japanese translations with correct values', () => {
    expect(ja['sidebar.folder']).toBe('フォルダ');
    expect(ja['viewer.loading']).toBe('読み込み中...');
    expect(ja['viewer.exportPdf']).toBe('PDF出力');
  });

  it('returns Simplified Chinese translations with correct values', () => {
    expect(zhCN['sidebar.folder']).toBe('文件夹');
    expect(zhCN['viewer.loading']).toBe('正在加载...');
    expect(zhCN['viewer.exportPdf']).toBe('导出 PDF');
  });

  it('has the same keys in all locales', () => {
    const enKeys = Object.keys(en).sort();
    const jaKeys = Object.keys(ja).sort();
    const zhCNKeys = Object.keys(zhCN).sort();
    expect(enKeys).toEqual(jaKeys);
    expect(enKeys).toEqual(zhCNKeys);
  });

  it('has no empty translation values', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en["${key}"] is empty`).not.toBe('');
    }
    for (const [key, value] of Object.entries(ja)) {
      expect(value, `ja["${key}"] is empty`).not.toBe('');
    }
    for (const [key, value] of Object.entries(zhCN)) {
      expect(value, `zh-CN["${key}"] is empty`).not.toBe('');
    }
  });

  it('contains zoom-related keys', () => {
    expect(en['viewer.zoom.in']).toBeDefined();
    expect(en['viewer.zoom.out']).toBeDefined();
    expect(en['viewer.zoom.reset']).toBeDefined();
  });

  it('contains lightbox-related keys', () => {
    expect(en['viewer.lightbox.close']).toBeDefined();
    expect(en['viewer.lightbox.download']).toBeDefined();
    expect(en['viewer.image.download']).toBeDefined();
    expect(en['viewer.mermaid.download']).toBeDefined();
  });
});
