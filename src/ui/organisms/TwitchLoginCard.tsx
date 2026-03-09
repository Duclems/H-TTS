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
      <p className="card-text" style={{ fontSize: "0.7rem", marginTop: "0.6rem", opacity: 0.8 }}>
        HI-TTS est une application gratuite de Hiarte. Ton token Twitch est stocké localement dans
        l&apos;application pour ton usage personnel uniquement et n&apos;est envoyé qu&apos;à Twitch. Ne le
        partage jamais.
      </p>
      <p className="card-text" style={{ fontSize: "0.7rem", marginTop: "0.2rem", opacity: 0.8 }}>
        Les détails sur le stockage du token et de la clé ElevenLabs sont expliqués dans &laquo; À propos
        &raquo; &gt; Politique de confidentialité.
      </p>
    </section>
  );
};
