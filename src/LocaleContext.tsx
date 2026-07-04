import { createContext, useCallback, useContext, useMemo } from "react";
import type { Locale, Translations } from "./i18n";
import { getTranslations } from "./i18n";

interface LocaleContextValue {
  locale: Locale;
  t: (key: keyof Translations, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  t: (key) => key,
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  // Stable per-locale identity so consumers memoizing on `t` (e.g. the markdown
  // component map) don't rebuild on every unrelated re-render.
  const t = useCallback(
    (key: keyof Translations, vars?: Record<string, string | number>): string => {
      let result: string = getTranslations(locale)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          // split/join, not replace(): replaces every occurrence and treats the
          // value as a literal (a `$` in a filename won't trigger $-patterns).
          result = result.split(`{${k}}`).join(String(v));
        }
      }
      return result;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

// context と対になる標準的なフックで、ファイル分割は import 側の複雑化に見合わない
// eslint-disable-next-line react-refresh/only-export-components
export function useTranslation() {
  return useContext(LocaleContext);
}
