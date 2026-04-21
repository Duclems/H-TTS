import { useEffect, useMemo, useRef, useState } from "react";
import type { TwitchTokenResponse } from "../../twitchAuth";
import type { TwitchCustomReward, TwitchRewardRedemption } from "../../twitchApi";
import type { ChatMessageWithEmotes } from "../../twitchChat";
import {
  STORAGE_KEY_REDEEM_AUDIO_COMPLETED as AUDIO_COMPLETED_KEY,
  STORAGE_KEY_REDEEM_FULFILL_COMPLETED as FULFILL_COMPLETED_KEY,
  STORAGE_KEY_EMOTES_BY_REDEMPTION as EMOTES_CACHE_KEY
} from "../../storageKeys";
import {
  VISIBLE_REDEMPTIONS_MAX,
  readRecentFulfilledRedemptions,
  readStringIdSet,
  type EmoteMatch
} from "./twitch/helpers";
import { useInitialTwitchLoad } from "./twitch/useInitialTwitchLoad";
import { useEventSubSubscription } from "./twitch/useEventSubSubscription";
import { useRedemptionTtsQueue } from "./twitch/useRedemptionTtsQueue";
import { useUserAvatars } from "./twitch/useUserAvatars";
import { useEmoteMatches } from "./twitch/useEmoteMatches";

export type { EmoteMatch } from "./twitch/helpers";
export { computeEmoteMatch } from "./twitch/helpers";

type TwitchRewardsState = {
  loading: boolean;
  error: string | null;
  broadcasterId: string | null;
  rewards: TwitchCustomReward[];
  setRewards: React.Dispatch<React.SetStateAction<TwitchCustomReward[]>>;
  redemptions: TwitchRewardRedemption[];
  recentFulfilled: TwitchRewardRedemption[];
  visibleRedemptions: TwitchRewardRedemption[];
  userAvatars: Record<string, string | null>;
  emoteMatches: Record<string, EmoteMatch>;
  chatMessagesRef: React.MutableRefObject<ChatMessageWithEmotes[]>;
};

export function useTwitchRewardsState(token: TwitchTokenResponse): TwitchRewardsState & {
  setError: (msg: string | null) => void;
} {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<TwitchCustomReward[]>([]);
  const [redemptions, setRedemptions] = useState<TwitchRewardRedemption[]>([]);
  const [recentFulfilled, setRecentFulfilled] = useState<TwitchRewardRedemption[]>(() =>
    readRecentFulfilledRedemptions()
  );
  const [userAvatars, setUserAvatars] = useState<Record<string, string | null>>({});
  const [emoteMatches, setEmoteMatches] = useState<Record<string, EmoteMatch>>({});

  const chatMessagesRef = useRef<ChatMessageWithEmotes[]>([]);
  const [chatVersion, setChatVersion] = useState(0);
  const audioDoneRef = useRef<Set<string>>(new Set());
  const fulfillDoneRef = useRef<Set<string>>(new Set());
  const rewardsRef = useRef<TwitchCustomReward[]>([]);
  const redemptionsFpRef = useRef<string | null>(null);

  useEffect(() => {
    audioDoneRef.current = readStringIdSet(AUDIO_COMPLETED_KEY);
    fulfillDoneRef.current = readStringIdSet(FULFILL_COMPLETED_KEY);

    const onStorage = (event: StorageEvent) => {
      if (event.key === AUDIO_COMPLETED_KEY) {
        audioDoneRef.current = readStringIdSet(AUDIO_COMPLETED_KEY);
      } else if (event.key === FULFILL_COMPLETED_KEY) {
        fulfillDoneRef.current = readStringIdSet(FULFILL_COMPLETED_KEY);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EMOTES_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, EmoteMatch>;
      if (parsed && typeof parsed === "object") setEmoteMatches(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    rewardsRef.current = rewards;
  }, [rewards]);

  useInitialTwitchLoad({
    token,
    chatMessagesRef,
    setChatVersion,
    setLoading,
    setError,
    setBroadcasterId,
    setRewards,
    setRedemptions,
    redemptionsFpRef
  });

  useEventSubSubscription({
    token,
    broadcasterId,
    rewardsRef,
    setRewards,
    setRedemptions,
    setRecentFulfilled,
    redemptionsFpRef
  });

  useRedemptionTtsQueue({
    token,
    broadcasterId,
    redemptions,
    chatMessagesRef,
    audioDoneRef,
    fulfillDoneRef,
    setRecentFulfilled
  });

  const visibleRedemptions = useMemo(() => {
    const byId = new Map<string, TwitchRewardRedemption>();
    for (const r of redemptions) byId.set(r.id, r);
    for (const r of recentFulfilled) if (!byId.has(r.id)) byId.set(r.id, r);
    return [...byId.values()]
      .sort((a, b) => {
        const ta = new Date(a.redeemed_at).getTime();
        const tb = new Date(b.redeemed_at).getTime();
        if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
        return tb - ta;
      })
      .slice(0, VISIBLE_REDEMPTIONS_MAX);
  }, [redemptions, recentFulfilled]);

  useUserAvatars({
    token,
    visibleRedemptions,
    userAvatars,
    setUserAvatars
  });

  useEmoteMatches({
    visibleRedemptions,
    chatMessagesRef,
    chatVersion,
    emoteMatches,
    setEmoteMatches
  });

  return {
    loading,
    error,
    setError,
    broadcasterId,
    rewards,
    setRewards,
    redemptions,
    recentFulfilled,
    visibleRedemptions,
    userAvatars,
    emoteMatches,
    chatMessagesRef
  };
}
