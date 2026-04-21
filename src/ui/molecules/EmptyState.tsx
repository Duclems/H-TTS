import { useI18n } from "../context/I18nContext";
import { HIARTE_HI_TTS_PROJECT_URL } from "../../config";

type Props = {
  text: string;
  variant?: "default" | "history";
  logoFaded?: boolean;
};

export const EmptyState = ({ text, variant = "default", logoFaded = false }: Props) => {
  const { t } = useI18n();
  const containerClass =
    variant === "history"
      ? "rewards-empty-state rewards-empty-state-history"
      : "rewards-empty-state";
  const logoClass = logoFaded
    ? "rewards-empty-state-logo rewards-empty-state-logo-faded"
    : "rewards-empty-state-logo";

  return (
    <div className={containerClass}>
      <a
        href={HIARTE_HI_TTS_PROJECT_URL}
        target="_blank"
        rel="noreferrer"
        className="hi-tts-project-link"
        aria-label={t("about.footerApp")}
      >
        <img src="/logos/hi-tts-animated.svg" alt="" className={logoClass} />
      </a>
      <p className="card-text rewards-empty-state-text">{text}</p>
    </div>
  );
};
