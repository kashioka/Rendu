import { createContext, useContext } from "react";
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
  const translations = getTranslations(locale);

  const t = (key: keyof Translations, vars?: Record<string, string | number>): string => {
    let result: string = translations[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }
    return result;
  };

  return (
    <LocaleContext.Provider value={{ locale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LocaleContext);
}
