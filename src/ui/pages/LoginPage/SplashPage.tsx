import { useI18n } from "../../context/I18nContext";
import { AppShellLogin } from "../../templates/AppShellLogin";
import { HIARTE_HI_TTS_PROJECT_URL } from "../../../config";

export const SplashPage = () => {
  const { t } = useI18n();

  return (
    <AppShellLogin mainVariant="splash">
      <a
        href={HIARTE_HI_TTS_PROJECT_URL}
        target="_blank"
        rel="noreferrer"
        className="hi-tts-project-link"
        aria-label={t("about.footerApp")}
      >
        <img
          src="/logos/hi-tts-animated.svg"
          alt=""
          style={{ width: "112px", height: "112px", opacity: 0.95 }}
        />
      </a>
    </AppShellLogin>
  );
};
