import { buildTwitchAuthorizeUrl } from "../../twitchAuth";
import { Button } from "../atoms/Button";
import { CardTitle } from "../atoms/CardTitle";

export const TwitchLoginCard = () => {
  const handleLogin = () => {
    const url = buildTwitchAuthorizeUrl();
    window.location.assign(url);
  };

  return (
    <section className="card">
      <CardTitle>Connexion à Twitch</CardTitle>
      <p className="card-text">
        Cette application utilise le{" "}
        <span className="pill">
          <span className="pill-dot" />
          OAuth2 Implicit Grant
        </span>{" "}
        de Twitch avec uniquement ton <code>client_id</code> (aucun secret côté client).
      </p>

      <Button variant="primary" onClick={handleLogin}>
        Se connecter avec Twitch
      </Button>
    </section>
  );
};
