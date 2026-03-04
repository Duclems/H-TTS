import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { TwitchTokenResponse } from "../../../twitchAuth";
import { clearStoredToken } from "../../../twitchAuth";
import { fetchCurrentUser, fetchFollowersCount, type TwitchUser } from "../../../twitchApi";

type Props = {
  token: TwitchTokenResponse;
};

export const AuthenticatedTokenCard = ({ token }: Props) => {
  const [user, setUser] = useState<TwitchUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentUser = await fetchCurrentUser(token.access_token);
        if (cancelled) return;

        if (!currentUser) {
          setError("Impossible de récupérer ton profil Twitch (vérifie les scopes).");
          return;
        }

        setUser(currentUser);

        const followers = await fetchFollowersCount(token.access_token, currentUser.id);
        if (!cancelled) {
          setFollowersCount(followers);
        }
      } catch {
        if (!cancelled) {
          setError("Erreur lors de la récupération du profil Twitch.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [token.access_token]);

  const handleLogout = () => {
    clearStoredToken();
    window.location.reload();
  };

  return (
    <section className="card">
      {error && <p className="error-text">{error}</p>}
      <div className="eleven-user-header">
        <div className="eleven-user-avatar">
          {loading || !user ? (
            <div className="skeleton skeleton-avatar" />
          ) : user.profile_image_url ? (
            <img src={user.profile_image_url} alt={user.display_name || user.login} />
          ) : (
            <span>{(user.display_name || user.login).charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="eleven-user-meta">
          <div className="eleven-user-name-row">
            {loading || !user ? (
              <div
                className="skeleton skeleton-line skeleton-line-main"
                style={{ "--skeleton-line-height": "10px" } as CSSProperties}
              />
            ) : (
              <div className="eleven-user-name">{user.display_name || user.login}</div>
            )}
            {loading || !user ? (
              <div
                className="skeleton skeleton-line skeleton-line-small"
                style={{ "--skeleton-line-height": "8px" } as CSSProperties}
              />
            ) : (
              typeof followersCount === "number" && (
                <div className="eleven-user-followers">
                • {followersCount.toLocaleString()} followers
                </div>
              )
            )}
          </div>
          {loading || !user ? (
            <div
              className="skeleton skeleton-line skeleton-line-small"
              style={{ "--skeleton-line-height": "6px" } as CSSProperties}
            />
          ) : (
            <div className="eleven-user-credits">@{user.login}</div>
          )}
        </div>
      </div>

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
        Déconnexion
      </button>
    </section>
  );
};

