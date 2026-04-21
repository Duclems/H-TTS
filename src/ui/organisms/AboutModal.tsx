import { useEffect } from "react";
import { HiarteLogoLink } from "../molecules/HiarteLogoLink";
import { ModalHeader } from "../molecules/ModalHeader";
import { LanguageSelector } from "../molecules/LanguageSelector";
import { useI18n } from "../context/I18nContext";
import pkg from "../../../package.json";
import { HIARTE_HI_TTS_PROJECT_URL } from "../../config";

type Props = {
  onClose: () => void;
};

export const AboutModal = ({ onClose }: Props) => {
  const { t } = useI18n();
  const version = pkg.version ?? "0.0.0";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const renderPrivacyBlock = (key: string) => {
    const raw = t(key);
    const [title, ...rest] = raw.split("\n");
    const body = rest.join("\n").trim();

    return (
      <div className="about-privacy-block">
        <div className="about-privacy-heading">{title}</div>
        {body && (
          <p className="card-text about-privacy-body">
            {body}
          </p>
        )}
      </div>
    );
  };
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-about-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel modal-content settings-modal-content settings-modal-has-footer" onClick={(e) => e.stopPropagation()}>
        <header>
          <ModalHeader
            titleId="settings-about-modal-title"
            title={t("settings.title")}
            onClose={onClose}
            closeAriaLabel={t("modal.close")}
            rightContent={
              <>
                <LanguageSelector />
              </>
            }
          />
        </header>

        <main className="settings-modal-main">
          <h3 className="about-main-title">{t("about.title")}</h3>

          <section>
            <p className="card-text about-hiarte-text">
              {t("about.hiTtsIntro")}
            </p>
          </section>

          <section className="about-hiarte">
            <HiarteLogoLink variant="section" />
            <p className="card-text about-hiarte-text-main">
              {t("about.hiarteBodyMain")}
            </p>
          </section>
          <p className="card-text about-hiarte-text">
            {t("about.hiarteBodyMore")}
            {" "}
            <a
              href="https://www.hiarte.fr/"
              target="_blank"
              rel="noreferrer"
              className="about-link"
            >
              {t("about.hiarteLink")}
            </a>
            .
          </p>

          <h4 className="about-privacy-title">
            {t("about.privacyTitle")}
          </h4>
          <p className="card-text about-privacy-intro">
            {t("about.privacyIntro")}
          </p>
          {renderPrivacyBlock("about.privacyTwitch")}
          {renderPrivacyBlock("about.privacyEleven")}
          {renderPrivacyBlock("about.privacyTransmission")}
          {renderPrivacyBlock("about.privacyStorage")}
        </main>

        <footer className="settings-modal-footer">
          <div className="about-footer-row">
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
      </div>
    </div>
  );
};
