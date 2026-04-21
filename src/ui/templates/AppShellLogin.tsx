import type { ReactNode } from "react";
import { LanguageSelector } from "../molecules/LanguageSelector";
import { useI18n } from "../context/I18nContext";

type Props = {
  children: ReactNode;
  mainVariant?: "default" | "splash";
};

export const AppShellLogin = ({ children, mainVariant = "default" }: Props) => {
  const { t } = useI18n();
  return (
    <div className="app-shell app-shell--login">
      <header className="app-shell-header">
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
      </header>
      <main className={mainVariant === "splash" ? "app-main app-main--splash" : "app-main"}>
        {children}
      </main>
    </div>
  );
};
