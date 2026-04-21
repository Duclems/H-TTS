import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { TwitchTokenResponse } from "../../../twitchAuth";
import {
  fetchCustomRewardsResult,
  fetchRewardRedemptionsResult,
  type TwitchCustomReward,
  type TwitchRewardRedemption
} from "../../../twitchApi";
import { connectEventSub, type EventSubConnection } from "../../../twitchEventSub";
import { logDebug } from "../../../debugLog";
import {
  appendRecentFulfilledRedemption,
  getRedemptionsFingerprint,
  mapEventSubRedemption,
  mapEventSubReward,
  rewardsActiveForPoll
} from "./helpers";

type Options = {
  token: TwitchTokenResponse;
  broadcasterId: string | null;
  rewardsRef: MutableRefObject<TwitchCustomReward[]>;
  setRewards: Dispatch<SetStateAction<TwitchCustomReward[]>>;
  setRedemptions: Dispatch<SetStateAction<TwitchRewardRedemption[]>>;
  setRecentFulfilled: Dispatch<SetStateAction<TwitchRewardRedemption[]>>;
  redemptionsFpRef: MutableRefObject<string | null>;
};

export function useEventSubSubscription({
  token,
  broadcasterId,
  rewardsRef,
  setRewards,
  setRedemptions,
  setRecentFulfilled,
  redemptionsFpRef
}: Options) {
  useEffect(() => {
    if (!broadcasterId) return;

    let disposed = false;

    const resyncFromHelix = async () => {
      if (disposed) return;
      try {
        const rewardsRes = await fetchCustomRewardsResult(token.access_token, broadcasterId);
        if (disposed || !rewardsRes.ok) return;
        setRewards(rewardsRes.data);

        const allRedemptions: TwitchRewardRedemption[] = [];
        for (const reward of rewardsActiveForPoll(rewardsRes.data)) {
          const redRes = await fetchRewardRedemptionsResult(
            token.access_token,
            broadcasterId,
            reward.id
          );
          if (disposed) return;
          if (redRes.ok) allRedemptions.push(...redRes.data);
        }
        const nextFp = getRedemptionsFingerprint(allRedemptions);
        if (nextFp !== redemptionsFpRef.current) {
          redemptionsFpRef.current = nextFp;
          setRedemptions(allRedemptions);
        }
        logDebug({
          timestamp: Date.now(),
          type: "reward",
          source: "eventsub-resync",
          message: `Resynced via Helix: ${rewardsRes.data.length} rewards, ${allRedemptions.length} pending redemptions.`
        });
      } catch (err) {
        logDebug({
          timestamp: Date.now(),
          type: "reward",
          source: "eventsub-resync",
          message: "Helix resync failed after EventSub reconnect.",
          details: err instanceof Error ? { name: err.name, message: err.message } : String(err)
        });
      }
    };

    const conn: EventSubConnection = connectEventSub({
      accessToken: token.access_token,
      broadcasterId,
      handlers: {
        onRedemptionAdd: (event) => {
          const mapped = mapEventSubRedemption(event, rewardsRef.current);
          if (!mapped) {
            logDebug({
              timestamp: Date.now(),
              type: "redeem",
              source: "eventsub",
              message: `Redemption received for unknown reward ${event.reward.id}; will catch up on next reward event or reconnect.`
            });
            return;
          }
          setRedemptions((prev) => {
            if (prev.some((r) => r.id === mapped.id)) return prev;
            return [mapped, ...prev];
          });
        },
        onRedemptionUpdate: (event) => {
          const status = event.status.toUpperCase();
          if (status === "FULFILLED" || status === "CANCELED") {
            setRedemptions((prev) => prev.filter((r) => r.id !== event.id));
            if (status === "FULFILLED") {
              const mapped = mapEventSubRedemption(event, rewardsRef.current);
              if (mapped) {
                setRecentFulfilled((prev) => appendRecentFulfilledRedemption(prev, mapped));
              }
            }
          }
        },
        onRewardAdd: (event) => {
          const reward = mapEventSubReward(event);
          setRewards((prev) =>
            prev.some((r) => r.id === reward.id) ? prev : [...prev, reward]
          );
        },
        onRewardUpdate: (event) => {
          const reward = mapEventSubReward(event);
          setRewards((prev) => {
            const idx = prev.findIndex((r) => r.id === reward.id);
            if (idx === -1) return [...prev, reward];
            const next = prev.slice();
            next[idx] = reward;
            return next;
          });
        },
        onRewardRemove: (event) => {
          setRewards((prev) => prev.filter((r) => r.id !== event.id));
        },
        onReconnect: () => {
          void resyncFromHelix();
        }
      }
    });

    return () => {
      disposed = true;
      conn.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.access_token, broadcasterId]);
}
