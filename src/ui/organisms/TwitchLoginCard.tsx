import { buildTwitchAuthorizeUrl } from "../../twitchAuth";

export const TwitchLoginCard = () => {
  const handleLogin = () => {
    const url = buildTwitchAuthorizeUrl();
    window.location.assign(url);
  };

  return (
    <section className="card">
      <div className="card-title">Connexion à Twitch</div>
      <p className="card-text">
        Cette application utilise le{" "}
        <span className="pill">
          <span className="pill-dot" />
          OAuth2 Implicit Grant
        </span>{" "}
        de Twitch avec uniquement ton <code>client_id</code> (aucun secret côté client).
      </p>

      <button type="button" className="twitch-button" onClick={handleLogin}>
        Se connecter avec Twitch
      </button>
    </section>
  );
};
