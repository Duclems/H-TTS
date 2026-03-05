import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { TwitchTokenResponse } from "../../../twitchAuth";
import { clearStoredToken } from "../../../twitchAuth";
import { fetchCurrentUser, fetchFollowersCount, type TwitchUser } from "../../../twitchApi";

const TWITCH_LAST_PROFILE_KEY = "h_tts_twitch_last_profile";

function saveLastTwitchProfile(user: TwitchUser, followersCount: number | null): void {
  try {
    window.localStorage.setItem(
      TWITCH_LAST_PROFILE_KEY,
      JSON.stringify({ user, followersCount })
    );
  } catch {
    window.localStorage.removeItem(TWITCH_LAST_PROFILE_KEY);
  }
}

function getInitialTwitchProfile(): { user: TwitchUser; followersCount: number | null } | null {
  try {
    const raw = window.localStorage.getItem(TWITCH_LAST_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user: TwitchUser; followersCount: number | null };
    if (!parsed?.user?.id || typeof parsed.user.login !== "string") return null;
    return {
      user: parsed.user,
      followersCount: typeof parsed.followersCount === "number" ? parsed.followersCount : null
    };
  } catch {
    return null;
  }
}

type Props = {
  token: TwitchTokenResponse;
};

export const AuthenticatedTokenCard = ({ token }: Props) => {
  const [user, setUser] = useState<TwitchUser | null>(
    () => getInitialTwitchProfile()?.user ?? null
  );
  const [followersCount, setFollowersCount] = useState<number | null>(
    () => getInitialTwitchProfile()?.followersCount ?? null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setUser(null);
          setFollowersCount(null);
          window.localStorage.removeItem(TWITCH_LAST_PROFILE_KEY);
          return;
        }

        setUser(currentUser);

        const followers = await fetchFollowersCount(token.access_token, currentUser.id);
        if (!cancelled) {
          setFollowersCount(followers);
          saveLastTwitchProfile(currentUser, followers);
        }
      } catch {
        if (!cancelled) {
          setError("Erreur lors de la récupération du profil Twitch.");
          setUser(null);
          setFollowersCount(null);
          window.localStorage.removeItem(TWITCH_LAST_PROFILE_KEY);
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
    window.localStorage.removeItem(TWITCH_LAST_PROFILE_KEY);
    clearStoredToken();
    window.location.reload();
  };

  return (
    <section className="card">
      {error && <p className="error-text">{error}</p>}
      <div className="eleven-user-header">
        <div className="eleven-user-avatar">
          {loading && !user ? (
            <div className="skeleton skeleton-avatar" />
          ) : user?.profile_image_url ? (
            <img src={user.profile_image_url} alt={user.display_name || user.login} />
          ) : user ? (
            <span>{(user.display_name || user.login).charAt(0).toUpperCase()}</span>
          ) : (
            <div className="skeleton skeleton-avatar" />
          )}
        </div>
        <div className="eleven-user-meta">
          <div className="eleven-user-name-row">
            {loading && !user ? (
              <div
                className="skeleton skeleton-line skeleton-line-main"
                style={{ "--skeleton-line-height": "10px" } as CSSProperties}
              />
            ) : user ? (
              <div className="eleven-user-name">{user.display_name || user.login}</div>
            ) : null}
            {loading && !user ? (
              <div
                className="skeleton skeleton-line skeleton-line-small"
                style={{ "--skeleton-line-height": "8px" } as CSSProperties}
              />
            ) : user && typeof followersCount === "number" ? (
              <div className="eleven-user-followers">
                • {followersCount.toLocaleString()} followers
              </div>
            ) : null}
          </div>
          {loading && !user ? (
            <div
              className="skeleton skeleton-line skeleton-line-small"
              style={{ "--skeleton-line-height": "6px" } as CSSProperties}
            />
          ) : user ? (
            <div className="eleven-user-credits">@{user.login}</div>
          ) : null}
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

