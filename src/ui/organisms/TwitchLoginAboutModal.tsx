import { useEffect } from "react";
import { ModalHeader } from "../molecules/ModalHeader";
import { useI18n } from "../context/I18nContext";

type Props = {
  onClose: () => void;
};

export const TwitchLoginAboutModal = ({ onClose }: Props) => {
  const { t } = useI18n();

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
        {body && <p className="card-text about-privacy-body">{body}</p>}
      </div>
    );
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="twitch-login-about-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="panel modal-content settings-modal-content twitch-login-about-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <ModalHeader
            titleId="twitch-login-about-modal-title"
            title={t("twitchLogin.aboutPrivacyButton")}
            onClose={onClose}
            closeAriaLabel={t("modal.close")}
          />
        </header>

        <main className="settings-modal-main twitch-login-about-main">
          <h3 className="about-main-title">{t("about.title")}</h3>

          <section>
            <p className="card-text about-hiarte-text">{t("about.hiTtsIntro")}</p>
          </section>

          <section className="about-hiarte">
            <img
              src="/logos/hiarte.svg"
              alt="Hiarte"
              className="about-hiarte-logo"
            />
            <p className="card-text about-hiarte-text-main">{t("about.hiarteBodyMain")}</p>
          </section>
          <p className="card-text about-hiarte-text">
            {t("about.hiarteBodyMore")}{" "}
            <a
              href="https://www.hiarte.fr"
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "underline dotted" }}
            >
              {t("about.hiarteLink")}
            </a>
            .
          </p>

          <h4 className="about-privacy-title">{t("about.privacyTitle")}</h4>
          <p className="card-text about-privacy-intro">{t("about.privacyIntro")}</p>
          {renderPrivacyBlock("about.privacyTwitch")}
          {renderPrivacyBlock("about.privacyEleven")}
          {renderPrivacyBlock("about.privacyTransmission")}
          {renderPrivacyBlock("about.privacyStorage")}
        </main>
      </div>
    </div>
  );
};

