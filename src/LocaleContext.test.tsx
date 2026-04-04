import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { LocaleProvider, useTranslation } from './LocaleContext';
import type { Locale } from './i18n';

function wrapper(locale: Locale) {
  return ({ children }: { children: React.ReactNode }) => (
    <LocaleProvider locale={locale}>{children}</LocaleProvider>
  );
}

describe('LocaleContext', () => {
  it('provides English translations', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper: wrapper('en') });
    expect(result.current.locale).toBe('en');
    expect(result.current.t('sidebar.folder')).toBe('Folder');
  });

  it('provides Japanese translations', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper: wrapper('ja') });
    expect(result.current.locale).toBe('ja');
    expect(result.current.t('sidebar.folder')).toBe('フォルダ');
  });

  it('interpolates path variable', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper: wrapper('en') });
    expect(result.current.t('viewer.error.path', { path: '/foo/bar.md' })).toBe('Path: /foo/bar.md');
  });

  it('interpolates count variable', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper: wrapper('en') });
    expect(result.current.t('viewer.matchCount', { count: 5 })).toBe('5 match(es)');
  });

  it('returns key as fallback without provider', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('sidebar.folder')).toBe('sidebar.folder');
  });
});
