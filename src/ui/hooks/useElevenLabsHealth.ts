import { useEffect, useState } from "react";
import { fetchElevenUser, fetchElevenVoices } from "../../elevenLabsApi";

const ELEVEN_CHECK_INTERVAL_MS = 30_000;

export type ElevenLabsHealth = {
  isValid: boolean | null;
  permissionsOk: boolean | null;
  credits: { remaining: number; limit: number } | null;
};

export function useElevenLabsHealth(apiKey: string, enabled: boolean): ElevenLabsHealth {
  const [health, setHealth] = useState<ElevenLabsHealth>({
    isValid: null,
    permissionsOk: null,
    credits: null
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let intervalId: number | null = null;

    const check = async () => {
      const trimmed = apiKey.trim();
      if (!trimmed) {
        if (cancelled) return;
        setHealth({ isValid: false, permissionsOk: null, credits: null });
        return;
      }

      const [user, voices] = await Promise.all([fetchElevenUser(), fetchElevenVoices()]);
      if (cancelled) return;

      const sub = user?.subscription;
      const hasCreditsInfo =
        !!sub && typeof sub.character_limit === "number" && typeof sub.character_count === "number";

      const credits =
        hasCreditsInfo && sub
          ? {
              remaining: Math.max(0, sub.character_limit - sub.character_count),
              limit: sub.character_limit
            }
          : null;

      setHealth({
        isValid: !!user && hasCreditsInfo,
        permissionsOk: user ? voices.length > 0 : null,
        credits
      });
    };

    const start = () => {
      if (intervalId !== null) return;
      void check();
      intervalId = window.setInterval(() => void check(), ELEVEN_CHECK_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [apiKey, enabled]);

  return health;
}
