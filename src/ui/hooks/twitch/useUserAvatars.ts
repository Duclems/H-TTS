import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { TwitchTokenResponse } from "../../../twitchAuth";
import { fetchUserByLogin, type TwitchRewardRedemption } from "../../../twitchApi";

type Options = {
  token: TwitchTokenResponse;
  visibleRedemptions: TwitchRewardRedemption[];
  userAvatars: Record<string, string | null>;
  setUserAvatars: Dispatch<SetStateAction<Record<string, string | null>>>;
};

export function useUserAvatars({
  token,
  visibleRedemptions,
  userAvatars,
  setUserAvatars
}: Options) {
  const avatarsInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const logins = Array.from(
      new Set(visibleRedemptions.map((r) => r.user_login.toLowerCase()))
    ).filter(
      (login) => !(login in userAvatars) && !avatarsInFlightRef.current.has(login)
    );

    if (logins.length === 0) return;

    let cancelled = false;
    for (const login of logins) avatarsInFlightRef.current.add(login);

    void Promise.all(
      logins.map(async (login) => {
        try {
          const user = await fetchUserByLogin(token.access_token, login);
          if (cancelled) return;
          setUserAvatars((prev) => ({ ...prev, [login]: user?.profile_image_url ?? null }));
        } catch {
          /* ignore */
        } finally {
          avatarsInFlightRef.current.delete(login);
        }
      })
    );

    return () => {
      cancelled = true;
    };
  }, [visibleRedemptions, token.access_token, userAvatars, setUserAvatars]);
}
