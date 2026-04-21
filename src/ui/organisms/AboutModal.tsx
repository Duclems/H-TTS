import { AboutContent } from "../molecules/AboutContent";
import { LanguageSelector } from "../molecules/LanguageSelector";
import { Modal } from "../molecules/Modal";
import { useI18n } from "../context/I18nContext";
import pkg from "../../../package.json";
import { HIARTE_HI_TTS_PROJECT_URL } from "../../config";

type Props = {
  onClose: () => void;
};

export const AboutModal = ({ onClose }: Props) => {
  const { t } = useI18n();
  const version = pkg.version ?? "0.0.0";

  return (
    <Modal
      titleId="settings-about-modal-title"
      title={t("settings.title")}
      onClose={onClose}
      headerRight={<LanguageSelector />}
      footer={
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
            <div className="about-footer-tagline">{t("about.footerTagline")}</div>
          </div>
        </div>
      }
    >
      <AboutContent />
    </Modal>
  );
};
