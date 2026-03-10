import { useI18n } from "../context/I18nContext";

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-selector" role="group" aria-label={t("language.label")}>
      <button
        type="button"
        className={`language-selector-btn${locale === "fr" ? " language-selector-btn-active" : ""}`}
        onClick={() => setLocale("fr")}
        aria-pressed={locale === "fr"}
        title={t("language.fr")}
      >
        FR
      </button>
      <button
        type="button"
        className={`language-selector-btn${locale === "en" ? " language-selector-btn-active" : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        title={t("language.en")}
      >
        EN
      </button>
    </div>
  );
}
