import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { TwitchTokenResponse } from "../../../twitchAuth";
import {
  fetchCurrentUser,
  fetchCustomRewardsResult,
  fetchRewardRedemptionsResult,
  type TwitchCustomReward,
  type TwitchHelixErr,
  type TwitchRewardRedemption
} from "../../../twitchApi";
import {
  addTwitchChatListener,
  removeTwitchChatListener,
  startTwitchChatLogger,
  stopTwitchChatLogger,
  type ChatMessageWithEmotes
} from "../../../twitchChat";
import { logDebug } from "../../../debugLog";
import {
  CHAT_BUFFER_MAX,
  getRedemptionsFingerprint,
  pollBackoffDelayMs,
  rewardsActiveForPoll,
  sleepMs
} from "./helpers";

type Options = {
  token: TwitchTokenResponse;
  chatMessagesRef: MutableRefObject<ChatMessageWithEmotes[]>;
  setChatVersion: Dispatch<SetStateAction<number>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setBroadcasterId: Dispatch<SetStateAction<string | null>>;
  setRewards: Dispatch<SetStateAction<TwitchCustomReward[]>>;
  setRedemptions: Dispatch<SetStateAction<TwitchRewardRedemption[]>>;
  redemptionsFpRef: MutableRefObject<string | null>;
};

export function useInitialTwitchLoad({
  token,
  chatMessagesRef,
  setChatVersion,
  setLoading,
  setError,
  setBroadcasterId,
  setRewards,
  setRedemptions,
  redemptionsFpRef
}: Options) {
  useEffect(() => {
    let cancelled = false;

    const onTwitchChatMessage = (msg: ChatMessageWithEmotes) => {
      const buffer = chatMessagesRef.current;
      if (buffer.length >= CHAT_BUFFER_MAX) buffer.shift();
      buffer.push(msg);
      if (msg.rewardId && msg.parsedEmotes.length > 0) {
        setChatVersion((v) => v + 1);
      }
    };

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const user = await fetchCurrentUser(token.access_token);
        if (!user) {
          setError("profile");
          return;
        }
        if (cancelled) return;

        setBroadcasterId(user.id);

        startTwitchChatLogger({ channelLogin: user.login });
        if (cancelled) return;

        addTwitchChatListener(onTwitchChatMessage);

        let rewardsData: TwitchCustomReward[] | null = null;
        let lastRewardsErr: TwitchHelixErr | null = null;
        for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
          const rr = await fetchCustomRewardsResult(token.access_token, user.id);
          if (cancelled) return;
          if (rr.ok) {
            rewardsData = rr.data;
            break;
          }
          lastRewardsErr = rr;
          if (attempt < 5) await sleepMs(pollBackoffDelayMs(rr, attempt + 1));
        }
        const rewardsList = rewardsData ?? [];
        if (!rewardsData && lastRewardsErr) {
          logDebug({
            timestamp: Date.now(),
            type: "reward",
            source: "rewards-initial",
            message: "Custom rewards Helix failed after retries; using empty list.",
            details: {
              status: lastRewardsErr.status,
              network: lastRewardsErr.network ?? false,
              retryAfterMs: lastRewardsErr.retryAfterMs
            }
          });
        }
        setRewards(rewardsList);

        const allRedemptions: TwitchRewardRedemption[] = [];
        for (const reward of rewardsActiveForPoll(rewardsList)) {
          let chunk: TwitchRewardRedemption[] | null = null;
          for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
            const rr = await fetchRewardRedemptionsResult(
              token.access_token,
              user.id,
              reward.id
            );
            if (cancelled) return;
            if (rr.ok) {
              chunk = rr.data;
              break;
            }
            if (attempt < 5) await sleepMs(pollBackoffDelayMs(rr, attempt + 1));
          }
          if (chunk) allRedemptions.push(...chunk);
          else {
            logDebug({
              timestamp: Date.now(),
              type: "reward",
              source: "rewards-initial",
              message: "Giving up on redemptions for one reward after retries.",
              details: { rewardId: reward.id }
            });
          }
        }
        const nextFp = getRedemptionsFingerprint(allRedemptions);
        if (nextFp !== redemptionsFpRef.current) {
          redemptionsFpRef.current = nextFp;
          setRedemptions(allRedemptions);
        }
      } catch (e) {
        logDebug({
          timestamp: Date.now(),
          type: "reward",
          source: "rewards-initial",
          message: "Unexpected error during initial rewards/redemptions load.",
          details: e instanceof Error ? { name: e.name, message: e.message } : String(e)
        });
        setRewards([]);
        setRedemptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      removeTwitchChatListener(onTwitchChatMessage);
      stopTwitchChatLogger();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.access_token]);
}
