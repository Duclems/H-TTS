import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { TwitchTokenResponse } from "../../twitchAuth";
import { clearStoredToken } from "../../twitchAuth";
import { fetchCurrentUser, fetchFollowersCount, type TwitchUser } from "../../twitchApi";
import { Avatar } from "../atoms/Avatar";
import { Button } from "../atoms/Button";
import { Skeleton } from "../atoms/Skeleton";
import { TokenChipRow } from "../molecules/TokenChipRow";
import { useI18n } from "../context/I18nContext";

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
  const { t } = useI18n();
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
          setError(t("tokenCard.errorProfile"));
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
          setError(t("tokenCard.errorFetch"));
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

  const scopeChips = [
    { label: `Type: ${token.token_type}` },
    ...token.scope.map((s) => ({ label: s }))
  ];

  return (
    <section className="card">
      {error && <p className="error-text">{error}</p>}
      <div className="eleven-user-header">
        {!user ? (
          <div className="eleven-user-avatar">
            <Skeleton variant="avatar" />
          </div>
        ) : (
          <Avatar
            src={user.profile_image_url}
            initial={user.display_name || user.login}
            alt={user.display_name || user.login}
          />
        )}
        <div className="eleven-user-meta">
          <div className="eleven-user-name-row">
            {loading && !user ? (
              <Skeleton variant="line" lineSize="main" style={{ "--skeleton-line-height": "10px" } as CSSProperties} />
            ) : user ? (
              <div className="eleven-user-name">{user.display_name || user.login}</div>
            ) : null}
            {loading && !user ? (
              <Skeleton variant="line" lineSize="small" style={{ "--skeleton-line-height": "8px" } as CSSProperties} />
            ) : user && typeof followersCount === "number" ? (
              <div className="eleven-user-followers">
                • {followersCount.toLocaleString()} {t("tokenCard.followers")}
              </div>
            ) : null}
          </div>
          {loading && !user ? (
            <Skeleton variant="line" lineSize="small" style={{ "--skeleton-line-height": "6px" } as CSSProperties} />
          ) : user ? (
            <div className="eleven-user-credits">@{user.login}</div>
          ) : null}
        </div>
      </div>

      <TokenChipRow chips={scopeChips} />

      <Button variant="danger" style={{ marginTop: "0.9rem" }} onClick={handleLogout}>
        {t("tokenCard.logout")}
      </Button>
    </section>
  );
};
