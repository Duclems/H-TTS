import { useEffect, useState } from "react";
import {
  isOAuthImplicitAccessDenied,
  parseHashFragment,
  storeToken,
  validateState
} from "../../../twitchAuth";
import { useI18n } from "../../context/I18nContext";

export const AuthCallbackPage = () => {
  const { t } = useI18n();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;

    if (isOAuthImplicitAccessDenied(hash)) {
      window.location.replace("/");
      return;
    }

    const parsed = parseHashFragment(hash);

    if (!parsed) {
      const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
      const params = new URLSearchParams(trimmed);
      if (params.get("error")) {
        setErrorKey("authCallback.errorOAuth");
        return;
      }
      window.location.replace("/");
      return;
    }

    const ok = validateState(parsed.state);
    if (!ok) {
      setErrorKey("authCallback.errorState");
      return;
    }

    void storeToken(parsed).then(() => {
      // Nettoie le fragment de l’URL puis retourne à la page d’accueil
      window.location.replace("/");
    });
  }, []);

  const handleBackHome = () => {
    window.location.replace("/");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-icon">H</div>
        <div>
          <div className="app-title">{t("authCallback.title")}</div>
          <div className="app-subtitle">
            {t("authCallback.subtitle")}
          </div>
        </div>
      </header>

      {errorKey && (
        <>
          <p className="error-text">{t(errorKey)}</p>
          <button
            type="button"
            className="twitch-button"
            style={{ marginTop: "0.9rem" }}
            onClick={handleBackHome}
          >
            {t("authCallback.backHome")}
          </button>
        </>
      )}
    </div>
  );
};

