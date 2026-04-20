import { LanguageSelector } from "../molecules/LanguageSelector";
import { useI18n } from "../context/I18nContext";

export const LoginPageHeader = () => {
  const { t } = useI18n();
  return (
    <div className="app-login-shell-header-inner">
      <a
        href="https://www.hiarte.fr/"
        target="_blank"
        rel="noreferrer"
        className="app-login-hiarte-brand"
        aria-label={t("about.hiarteLink")}
      >
        <img src="/logos/hiarte.svg" alt="" />
        <span className="app-login-hiarte-arte-word" aria-hidden="true">
          ARTE
        </span>
      </a>
      <div className="app-login-shell-header-lang">
        <span className="twitch-login-card-lang-label">{t("language.label")}</span>
        <LanguageSelector />
      </div>
    </div>
  );
};
