import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { TwitchRewardRedemption } from "../../../twitchApi";
import type { ChatMessageWithEmotes } from "../../../twitchChat";
import { STORAGE_KEY_EMOTES_BY_REDEMPTION as EMOTES_CACHE_KEY } from "../../../storageKeys";
import { computeEmoteMatch, type EmoteMatch } from "./helpers";

type Options = {
  visibleRedemptions: TwitchRewardRedemption[];
  chatMessagesRef: MutableRefObject<ChatMessageWithEmotes[]>;
  chatVersion: number;
  emoteMatches: Record<string, EmoteMatch>;
  setEmoteMatches: Dispatch<SetStateAction<Record<string, EmoteMatch>>>;
};

export function useEmoteMatches({
  visibleRedemptions,
  chatMessagesRef,
  chatVersion,
  emoteMatches,
  setEmoteMatches
}: Options) {
  useEffect(() => {
    if (visibleRedemptions.length === 0) return;
    const messages = chatMessagesRef.current;
    if (messages.length === 0) return;

    const updates: Record<string, EmoteMatch> = {};
    for (const r of visibleRedemptions) {
      if (emoteMatches[r.id]) continue;
      const match = computeEmoteMatch(r, messages);
      if (match.emotes.length > 0) updates[r.id] = match;
    }
    if (Object.keys(updates).length === 0) return;

    setEmoteMatches((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(EMOTES_CACHE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRedemptions, chatVersion]);
}
