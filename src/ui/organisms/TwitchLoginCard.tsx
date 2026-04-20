import { useState } from "react";
import { buildTwitchAuthorizeUrl } from "../../twitchAuth";
import { Button } from "../atoms/Button";
import { CardTitle } from "../atoms/CardTitle";
import { useI18n } from "../context/I18nContext";
import { TwitchLoginAboutModal } from "./TwitchLoginAboutModal";
import pkg from "../../../package.json";
import { HIARTE_HI_TTS_PROJECT_URL } from "../../config";

export const TwitchLoginCard = () => {
  const { t } = useI18n();
  const version = pkg.version ?? "0.0.0";
  const [aboutOpen, setAboutOpen] = useState(false);
  const handleLogin = () => {
    const url = buildTwitchAuthorizeUrl();
    window.location.assign(url);
  };

  return (
    <section className="card twitch-login-card">
      <div className="twitch-login-main-cta">
        <CardTitle>{t("twitchLogin.title")}</CardTitle>
        <p className="card-text twitch-login-intro">
          {t("twitchLogin.intro")}
        </p>

        <Button variant="primary" onClick={handleLogin}>
          {t("twitchLogin.cta")}
        </Button>
        <p className="card-text twitch-login-note">
          {t("twitchLogin.tokenNote")}
        </p>
        <button
          type="button"
          className="twitch-login-about-button"
          onClick={() => setAboutOpen(true)}
        >
          {t("twitchLogin.aboutPrivacyButton")}
        </button>
      </div>

      <footer className="twitch-login-footer">
        <div className="twitch-login-footer-row">
          <a
            href={HIARTE_HI_TTS_PROJECT_URL}
            target="_blank"
            rel="noreferrer"
            className="hi-tts-project-link"
            style={{ width: 48, height: 48, flexShrink: 0, display: "block" }}
            aria-label={t("about.footerApp")}
          >
            <img src="/logos/hi-tts-animated.svg" alt="" className="about-footer-logo" />
          </a>
          <div className="about-footer-meta">
            <div className="about-footer-title-row">
              <div className="about-footer-title">{t("about.footerApp")}</div>
              <div className="about-footer-version">• {`v${version}`}</div>
            </div>
            <div className="about-footer-tagline">
              {t("about.footerTagline")}
            </div>
          </div>
        </div>
      </footer>

      {aboutOpen && <TwitchLoginAboutModal onClose={() => setAboutOpen(false)} />}
    </section>
  );
};
