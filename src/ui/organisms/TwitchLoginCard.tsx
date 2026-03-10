import { buildTwitchAuthorizeUrl } from "../../twitchAuth";
import { Button } from "../atoms/Button";
import { CardTitle } from "../atoms/CardTitle";
import { useI18n } from "../context/I18nContext";

export const TwitchLoginCard = () => {
  const { t } = useI18n();
  const handleLogin = () => {
    const url = buildTwitchAuthorizeUrl();
    window.location.assign(url);
  };

  return (
    <section className="card">
      <CardTitle>{t("twitchLogin.title")}</CardTitle>
      <p className="card-text">
        {t("twitchLogin.intro")}
      </p>

      <Button variant="primary" onClick={handleLogin}>
        {t("twitchLogin.cta")}
      </Button>
      <p className="card-text" style={{ fontSize: "0.7rem", marginTop: "0.6rem", opacity: 0.8 }}>
        {t("twitchLogin.tokenNote")}
      </p>
      <p className="card-text" style={{ fontSize: "0.7rem", marginTop: "0.2rem", opacity: 0.8 }}>
        {t("twitchLogin.detailsLink")}
      </p>
    </section>
  );
};
