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
          <h3 style={{ fontSize: "0.8rem", marginTop: "0", marginBottom: "0.5rem" }}>
            {t("about.title")}
          </h3>
          <h4 style={{ fontSize: "0.75rem", marginTop: "0", marginBottom: "0.25rem", fontWeight: 600 }}>
            {t("about.privacyTitle")}
          </h4>
          <p className="card-text" style={{ fontSize: "0.75rem" }} dangerouslySetInnerHTML={{ __html: t("about.twitchPrivacy") }} />
          <p className="card-text" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }} dangerouslySetInnerHTML={{ __html: t("about.elevenPrivacy") }} />
          <p className="card-text" style={{ fontSize: "0.75rem", marginTop: "0.35rem", opacity: 0.85 }} dangerouslySetInnerHTML={{ __html: t("about.noDataSent") }} />
        </main>

        <footer className="settings-modal-footer">
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
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                {`v${version}`}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
