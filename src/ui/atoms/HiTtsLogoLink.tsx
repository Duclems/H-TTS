import type { CSSProperties } from "react";
import { HIARTE_HI_TTS_PROJECT_URL } from "../../config";
import { useI18n } from "../context/I18nContext";

type Props = {
  imgClassName?: string;
  linkClassName?: string;
  linkStyle?: CSSProperties;
  imgStyle?: CSSProperties;
};

export const HiTtsLogoLink = ({
  imgClassName,
  linkClassName,
  linkStyle,
  imgStyle
}: Props) => {
  const { t } = useI18n();
  const className = linkClassName
    ? `hi-tts-project-link ${linkClassName}`
    : "hi-tts-project-link";
  return (
    <a
      href={HIARTE_HI_TTS_PROJECT_URL}
      target="_blank"
      rel="noreferrer"
      className={className}
      style={linkStyle}
      aria-label={t("about.footerApp")}
    >
      <img src="/logos/hi-tts-animated.svg" alt="" className={imgClassName} style={imgStyle} />
    </a>
  );
};
