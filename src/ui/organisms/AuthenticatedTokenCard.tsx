import { useEffect, useState } from "react";
import type { TwitchTokenResponse } from "../../twitchAuth";
import { clearStoredToken } from "../../twitchAuth";
import { fetchCurrentUser, fetchFollowersCount, type TwitchUser } from "../../twitchApi";
import { Button } from "../atoms/Button";
import { TokenChipRow } from "../molecules/TokenChipRow";
import { UserHeader } from "../molecules/UserHeader";
import { useI18n } from "../context/I18nContext";
import { STORAGE_KEY_TWITCH_LAST_PROFILE as TWITCH_LAST_PROFILE_KEY } from "../../storageKeys";

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
    void clearStoredToken().then(() => {
      window.location.reload();
    });
  };

  const scopeChips = [
    { label: `Type: ${token.token_type}` },
    ...token.scope.map((s) => ({ label: s }))
  ];

  return (
    <section className="card">
      {error && <p className="error-text">{error}</p>}
      <UserHeader
        loading={loading && !user}
        avatarUrl={user?.profile_image_url}
        name={user ? user.display_name || user.login : undefined}
        nameSuffix={
          user && typeof followersCount === "number" ? (
            <div className="eleven-user-followers">
              • {followersCount.toLocaleString()} {t("tokenCard.followers")}
            </div>
          ) : undefined
        }
        meta={user ? <div className="eleven-user-credits">@{user.login}</div> : undefined}
      />

      <TokenChipRow chips={scopeChips} />

      <Button variant="danger" style={{ marginTop: "0.9rem" }} onClick={handleLogout}>
        {t("tokenCard.logout")}
      </Button>
    </section>
  );
};
