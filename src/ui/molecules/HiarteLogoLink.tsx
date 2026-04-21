import { useI18n } from "../context/I18nContext";

export const HiarteLogoLink = () => {
  const { t } = useI18n();
  return (
    <a
      href="https://www.hiarte.fr/"
      target="_blank"
      rel="noreferrer"
      className="about-hiarte-logo-link"
      aria-label={t("about.hiarteLink")}
    >
      <img src="/logos/hiarte.svg" alt="" className="about-hiarte-logo" />
    </a>
  );
};
