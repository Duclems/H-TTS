import { buildTwitchAuthorizeUrl } from "../../twitchAuth";
import { Button } from "../atoms/Button";
import { CardTitle } from "../atoms/CardTitle";
import { LanguageSelector } from "../molecules/LanguageSelector";
import { useI18n } from "../context/I18nContext";

export const TwitchLoginCard = () => {
  const { t } = useI18n();
  const handleLogin = () => {
    const url = buildTwitchAuthorizeUrl();
    window.location.assign(url);
  };

  return (
    <section className="card twitch-login-card">
      <div className="twitch-login-card-lang" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t("language.label")}</span>
        <LanguageSelector />
      </div>

      <CardTitle>{t("twitchLogin.title")}</CardTitle>
      <p className="card-text">
        {t("twitchLogin.intro")}
      </p>

      <Button variant="primary" onClick={handleLogin}>
        {t("twitchLogin.cta")}
      </Button>
      <p className="card-text" style={{ fontSize: "0.7rem", marginTop: "0.6rem", opacity: 0.8 }}>
        {t("twitchLogin.tokenNote")}
      </p>
      <p className="card-text" style={{ fontSize: "0.7rem", marginTop: "0.2rem", opacity: 0.8 }}>
        {t("twitchLogin.detailsLink")}
      </p>

      <footer className="twitch-login-footer">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <img
            src="/logos/hi-tts-animated.svg"
            alt={t("about.footerApp")}
            style={{ width: 48, height: 48, display: "block", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{t("about.footerApp")}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {t("about.footerTagline")}
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
};
