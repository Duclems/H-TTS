import { HiarteLogoLink } from "./HiarteLogoLink";
import { PrivacyBlock } from "./PrivacyBlock";
import { useI18n } from "../context/I18nContext";

export const AboutContent = () => {
  const { t } = useI18n();

  return (
    <>
      <h3 className="about-main-title">{t("about.title")}</h3>

      <section>
        <p className="card-text about-hiarte-text">{t("about.hiTtsIntro")}</p>
      </section>

      <section className="about-hiarte">
        <HiarteLogoLink />
        <p className="card-text about-hiarte-text-main">{t("about.hiarteBodyMain")}</p>
      </section>
      <p className="card-text about-hiarte-text">
        {t("about.hiarteBodyMore")}{" "}
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

      <h4 className="about-privacy-title">{t("about.privacyTitle")}</h4>
      <p className="card-text about-privacy-intro">{t("about.privacyIntro")}</p>
      <PrivacyBlock i18nKey="about.privacyTwitch" />
      <PrivacyBlock i18nKey="about.privacyEleven" />
      <PrivacyBlock i18nKey="about.privacyTransmission" />
      <PrivacyBlock i18nKey="about.privacyStorage" />
    </>
  );
};
