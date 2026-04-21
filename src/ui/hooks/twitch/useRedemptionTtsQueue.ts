import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { TwitchTokenResponse } from "../../../twitchAuth";
import {
  updateRewardRedemptionStatus,
  type TwitchRewardRedemption
} from "../../../twitchApi";
import type { ChatMessageWithEmotes } from "../../../twitchChat";
import { speakWithElevenLabsFromText } from "../../../elevenLabsApi";
import { loadAllRewardVoiceConfigs } from "../../../rewardVoiceConfig";
import { logDebug } from "../../../debugLog";
import {
  STORAGE_KEY_REDEEM_AUDIO_COMPLETED as AUDIO_COMPLETED_KEY,
  STORAGE_KEY_REDEEM_FULFILL_COMPLETED as FULFILL_COMPLETED_KEY
} from "../../../storageKeys";
import {
  appendRecentFulfilledRedemption,
  computeEmoteMatch,
  persistStringIdSet
} from "./helpers";

const redeemTtsInFlightIds = new Set<string>();

type Options = {
  token: TwitchTokenResponse;
  broadcasterId: string | null;
  redemptions: TwitchRewardRedemption[];
  chatMessagesRef: MutableRefObject<ChatMessageWithEmotes[]>;
  audioDoneRef: MutableRefObject<Set<string>>;
  fulfillDoneRef: MutableRefObject<Set<string>>;
  setRecentFulfilled: Dispatch<SetStateAction<TwitchRewardRedemption[]>>;
};

export function useRedemptionTtsQueue({
  token,
  broadcasterId,
  redemptions,
  chatMessagesRef,
  audioDoneRef,
  fulfillDoneRef,
  setRecentFulfilled
}: Options) {
  useEffect(() => {
    if (redemptions.length === 0 || !broadcasterId) return;

    let cancelled = false;

    const markAudioDone = (id: string) => {
      if (audioDoneRef.current.has(id)) return;
      audioDoneRef.current.add(id);
      persistStringIdSet(AUDIO_COMPLETED_KEY, audioDoneRef.current);
    };

    const markFulfillDone = (id: string) => {
      if (fulfillDoneRef.current.has(id)) return;
      fulfillDoneRef.current.add(id);
      persistStringIdSet(FULFILL_COMPLETED_KEY, fulfillDoneRef.current);
    };

    const fulfillRedemption = async (redemption: TwitchRewardRedemption) => {
      const ok = await updateRewardRedemptionStatus(
        token.access_token,
        broadcasterId,
        redemption.reward.id,
        [redemption.id],
        "FULFILLED"
      );
      if (!ok) {
        logDebug({
          timestamp: Date.now(),
          type: "redeem",
          source: "redeem-fulfill",
          message: "Failed to mark Twitch redemption as FULFILLED (will retry).",
          details: { redemptionId: redemption.id, rewardId: redemption.reward.id }
        });
        return false;
      }

      const fulfilled: TwitchRewardRedemption = { ...redemption, status: "FULFILLED" };
      setRecentFulfilled((prev) => appendRecentFulfilledRedemption(prev, fulfilled));

      logDebug({
        timestamp: Date.now(),
        type: "redeem",
        source: "redeem-fulfill",
        message: "Twitch redemption marked as FULFILLED after TTS playback.",
        details: { redemptionId: redemption.id, rewardId: redemption.reward.id }
      });
      return true;
    };

    const run = async () => {
      const pending = redemptions.filter((r) => !fulfillDoneRef.current.has(r.id));
      if (pending.length === 0) return;

      const voiceConfigs = loadAllRewardVoiceConfigs();

      for (const redemption of pending) {
        if (cancelled) return;

        if (audioDoneRef.current.has(redemption.id)) {
          const ok = await fulfillRedemption(redemption);
          if (ok) markFulfillDone(redemption.id);
          continue;
        }

        if (!redemption.user_input || !redemption.user_input.trim()) {
          markAudioDone(redemption.id);
          markFulfillDone(redemption.id);
          continue;
        }

        const redeemedAt = new Date(redemption.redeemed_at).getTime();
        if (Number.isNaN(redeemedAt)) continue;

        const isFresh = Date.now() - redeemedAt <= 30_000;
        if (!isFresh) {
          markAudioDone(redemption.id);
          markFulfillDone(redemption.id);
          continue;
        }

        const voiceConfig = voiceConfigs[redemption.reward.id] ?? null;
        const { emotes, chatText } = computeEmoteMatch(redemption, chatMessagesRef.current);
        const baseText = (chatText ?? redemption.user_input ?? "").toString();

        const cleanedText =
          emotes.length === 0
            ? baseText
            : (() => {
                let cursor = 0;
                let result = "";
                const sorted = emotes
                  .flatMap((e) => e.positions.map((p) => ({ start: p.start, end: p.end })))
                  .sort((a, b) => a.start - b.start);
                for (const { start, end } of sorted) {
                  if (start > cursor) result += baseText.slice(cursor, start);
                  cursor = end + 1;
                }
                if (cursor < baseText.length) result += baseText.slice(cursor);
                return result.replace(/\s+/g, " ").trim();
              })();

        if (!cleanedText) {
          logDebug({
            timestamp: Date.now(),
            type: "redeem",
            source: "redeem-skip",
            message: "Redemption skipped: no usable text after cleanup.",
            details: { redemptionId: redemption.id, rewardId: redemption.reward.id }
          });
          markAudioDone(redemption.id);
          markFulfillDone(redemption.id);
          continue;
        }

        if (redeemTtsInFlightIds.has(redemption.id)) continue;
        redeemTtsInFlightIds.add(redemption.id);

        try {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log("[Hi-TTS] Nouvelle redemption à lire via ElevenLabs", {
              id: redemption.id,
              rewardId: redemption.reward.id,
              user: redemption.user_display_name || redemption.user_login,
              rawText: redemption.user_input,
              cleanedText
            });
          }

          logDebug({
            timestamp: Date.now(),
            type: "redeem",
            source: "redeem-tts",
            message: "Starting ElevenLabs TTS for a new redemption.",
            details: {
              redemptionId: redemption.id,
              rewardId: redemption.reward.id,
              user: redemption.user_display_name || redemption.user_login,
              text: cleanedText
            }
          });

          const tts = await speakWithElevenLabsFromText(cleanedText, voiceConfig);
          if (!tts.playedToEnd) continue;

          markAudioDone(redemption.id);
          const ok = await fulfillRedemption(redemption);
          if (ok) markFulfillDone(redemption.id);
        } finally {
          redeemTtsInFlightIds.delete(redemption.id);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redemptions, broadcasterId, token.access_token]);
}
