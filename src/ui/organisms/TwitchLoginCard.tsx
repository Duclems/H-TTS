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
        L’application a besoin d’une connexion à Twitch pour accéder à la suite.
      </p>

      <Button variant="primary" onClick={handleLogin}>
        Se connecter avec Twitch
      </Button>
    </section>
  );
};
