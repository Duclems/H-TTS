import type { TwitchTokenResponse } from "../../../twitchAuth";
import { clearStoredToken } from "../../../twitchAuth";

type Props = {
  token: TwitchTokenResponse;
};

export const AuthenticatedTokenCard = ({ token }: Props) => {
  const handleLogout = () => {
    clearStoredToken();
    window.location.reload();
  };

  return (
    <section className="card">
      <div className="card-title">Session Twitch</div>
      <p className="token-info">
        <small>Access token (raccourci) :</small>
        <br />
        {token.access_token.slice(0, 20)}…
      </p>

      <div className="token-chip-row">
        <span className="token-chip">Type: {token.token_type}</span>
        {token.scope.map((s) => (
          <span key={s} className="token-chip">
            {s}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="twitch-button btn-danger"
        style={{ marginTop: "0.9rem" }}
        onClick={handleLogout}
      >
        Déconnexion locale
      </button>
    </section>
  );
};

