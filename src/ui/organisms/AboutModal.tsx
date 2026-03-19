import { useEffect } from "react";
import { ModalHeader } from "../molecules/ModalHeader";
import { LanguageSelector } from "../molecules/LanguageSelector";
import { useI18n } from "../context/I18nContext";
import pkg from "../../../package.json";

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
            rightContent={<LanguageSelector />}
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
            <img
              src="/logos/hiarte.svg"
              alt="Hiarte"
              className="about-hiarte-logo"
            />
            <p className="card-text about-hiarte-text-main">
              {t("about.hiarteBodyMain")}
            </p>
          </section>
          <p className="card-text about-hiarte-text">
            {t("about.hiarteBodyMore")}
            {" "}
            <a
              href="https://www.hiarte.fr/about"
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "underline dotted" }}
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
            <img
              src="/logos/hi-tts-animated.svg"
              alt={t("about.footerApp")}
              className="about-footer-logo"
            />
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
