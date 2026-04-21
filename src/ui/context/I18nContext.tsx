import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import fr from "../../locales/fr.json";
import en from "../../locales/en.json";
import { STORAGE_KEY_LOCALE } from "../../storageKeys";

type Locale = "fr" | "en";

type MessagesTree = Record<string, unknown>;

function flattenInto(tree: MessagesTree, out: Record<string, string>, prefix = ""): void {
  for (const [key, value] of Object.entries(tree)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[fullKey] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenInto(value as MessagesTree, out, fullKey);
    }
  }
}

const flatMessages: Record<Locale, Record<string, string>> = {
  fr: {},
  en: {}
};
flattenInto(fr as MessagesTree, flatMessages.fr);
flattenInto(en as MessagesTree, flatMessages.en);

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LOCALE);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  return "fr";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY_LOCALE, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const bridge = window.hiTtsApp?.setLocale;
    if (bridge) {
      void bridge(locale);
    }
  }, [locale]);

  const t = useCallback(
    (key: string): string => flatMessages[locale][key] ?? key,
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
