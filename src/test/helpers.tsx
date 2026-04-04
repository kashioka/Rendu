import { type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { LocaleProvider } from '../LocaleContext';
import type { Locale } from '../i18n';

export function renderWithLocale(
  ui: ReactNode,
  { locale = 'en' as Locale, ...options }: RenderOptions & { locale?: Locale } = {}
) {
  return render(
    <LocaleProvider locale={locale}>{ui}</LocaleProvider>,
    options
  );
}
