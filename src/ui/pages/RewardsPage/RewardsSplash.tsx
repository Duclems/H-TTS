import { HIARTE_HI_TTS_PROJECT_URL } from "../../../config";
import { useI18n } from "../../context/I18nContext";

export const RewardsSplash = () => {
  const { t } = useI18n();
  return (
    <section className="card">
      <div className="rewards-splash">
        <a
          href={HIARTE_HI_TTS_PROJECT_URL}
          target="_blank"
          rel="noreferrer"
          className="hi-tts-project-link"
          aria-label={t("about.footerApp")}
        >
          <img src="/logos/hi-tts-animated.svg" alt="" className="rewards-splash-logo" />
        </a>
      </div>
    </section>
  );
};
