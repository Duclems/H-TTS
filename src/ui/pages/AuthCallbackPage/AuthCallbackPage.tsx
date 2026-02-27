import { useEffect, useState } from "react";
import { parseHashFragment, storeToken, validateState } from "../../../twitchAuth";

export const AuthCallbackPage = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const parsed = parseHashFragment(hash);

    if (!parsed) {
      setError("Impossible de lire la réponse OAuth de Twitch.");
      return;
    }

    const ok = validateState(parsed.state);
    if (!ok) {
      setError("Le paramètre de sécurité 'state' ne correspond pas. Abandon.");
      return;
    }

    storeToken(parsed);

    // Nettoie le fragment de l’URL puis retourne à la page d’accueil
    window.location.replace("/");
  }, []);

  const handleBackHome = () => {
    window.location.replace("/");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-icon">H</div>
        <div>
          <div className="app-title">Traitement du callback Twitch…</div>
          <div className="app-subtitle">
            Nous analysons la réponse OAuth puis te redirigeons.
          </div>
        </div>
      </header>

      {error && (
        <>
          <p className="error-text">{error}</p>
          <button
            type="button"
            className="twitch-button"
            style={{ marginTop: "0.9rem" }}
            onClick={handleBackHome}
          >
            Revenir à l&apos;accueil
          </button>
        </>
      )}
    </div>
  );
};

