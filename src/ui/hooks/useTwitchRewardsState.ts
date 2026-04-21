import { useEffect, useMemo, useRef, useState } from "react";
import type { TwitchTokenResponse } from "../../twitchAuth";
import {
  fetchCurrentUser,
  fetchCustomRewardsResult,
  fetchRewardRedemptionsResult,
  fetchUserByLogin,
  updateRewardRedemptionStatus,
  type TwitchCustomReward,
  type TwitchHelixErr,
  type TwitchRewardRedemption
} from "../../twitchApi";
import {
  addTwitchChatListener,
  removeTwitchChatListener,
  startTwitchChatLogger,
  stopTwitchChatLogger,
  type ChatMessageWithEmotes,
  type ParsedEmote
} from "../../twitchChat";
import {
  connectEventSub,
  type EventSubConnection,
  type EventSubRedeemEvent,
  type EventSubRewardEvent
} from "../../twitchEventSub";
import { speakWithElevenLabsFromText } from "../../elevenLabsApi";
import { loadAllRewardVoiceConfigs } from "../../rewardVoiceConfig";
import { logDebug } from "../../debugLog";
import {
  STORAGE_KEY_REDEEM_AUDIO_COMPLETED as AUDIO_COMPLETED_KEY,
  STORAGE_KEY_REDEEM_FULFILL_COMPLETED as FULFILL_COMPLETED_KEY,
  STORAGE_KEY_RECENT_FULFILLED_REDEMPTIONS as RECENT_FULFILLED_KEY,
  STORAGE_KEY_EMOTES_BY_REDEMPTION as EMOTES_CACHE_KEY
} from "../../storageKeys";

export type EmoteMatch = { emotes: ParsedEmote[]; chatText?: string };

const POLL_BACKOFF_MAX_MS = 120_000;
const RECENT_FULFILLED_MAX = 5;
const VISIBLE_REDEMPTIONS_MAX = 5;
const COMPLETION_SET_MAX = 500;
const CHAT_BUFFER_MAX = 200;

const REDEEM_FP_SEP = "\u001f";
const REDEEM_ROW_SEP = "\u001e";

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pollBackoffDelayMs(err: TwitchHelixErr, consecutiveFailures: number): number {
  if (err.retryAfterMs != null && err.retryAfterMs > 0) {
    return Math.min(POLL_BACKOFF_MAX_MS, err.retryAfterMs);
  }
  if (err.network) {
    return Math.min(POLL_BACKOFF_MAX_MS, 2_000 * 2 ** Math.min(Math.max(0, consecutiveFailures - 1), 6));
  }
  if (err.status === 429) return Math.min(POLL_BACKOFF_MAX_MS, 10_000);
  if (err.status >= 500) return Math.min(POLL_BACKOFF_MAX_MS, 5_000);
  return Math.min(POLL_BACKOFF_MAX_MS, 15_000);
}

function rewardsActiveForPoll(all: TwitchCustomReward[]): TwitchCustomReward[] {
  return all.filter((r) => r.is_enabled);
}

function getRedemptionsFingerprint(list: TwitchRewardRedemption[]): string {
  if (list.length === 0) return "";
  return [...list]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) =>
      [
        r.id,
        r.redeemed_at,
        r.status,
        r.reward.id,
        r.user_login,
        r.user_display_name,
        r.reward.title,
        r.user_input ?? ""
      ].join(REDEEM_FP_SEP)
    )
    .join(REDEEM_ROW_SEP);
}

function readStringIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function persistStringIdSet(key: string, set: Set<string>) {
  if (set.size > COMPLETION_SET_MAX) {
    const iter = set.values();
    while (set.size > COMPLETION_SET_MAX) {
      const next = iter.next();
      if (next.done) break;
      set.delete(next.value);
    }
  }
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

function readRecentFulfilledRedemptions(): TwitchRewardRedemption[] {
  try {
    const raw = localStorage.getItem(RECENT_FULFILLED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TwitchRewardRedemption[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendRecentFulfilledRedemption(
  prev: TwitchRewardRedemption[],
  redemption: TwitchRewardRedemption
): TwitchRewardRedemption[] {
  const filtered = prev.filter((r) => r.id !== redemption.id);
  const next = [redemption, ...filtered].slice(0, RECENT_FULFILLED_MAX);
  try {
    localStorage.setItem(RECENT_FULFILLED_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function computeEmoteMatch(
  redemption: TwitchRewardRedemption,
  messages: ChatMessageWithEmotes[]
): EmoteMatch {
  if (messages.length === 0) return { emotes: [] };

  const textRaw = (redemption.user_input ?? "").trim();
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const text = normalize(textRaw);
  const login = redemption.user_login.toLowerCase();
  const display = redemption.user_display_name?.toLowerCase();
  const rewardId = redemption.reward.id;
  const redeemedAt = new Date(redemption.redeemed_at).getTime();

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg.parsedEmotes.length) continue;
    if (msg.rewardId !== rewardId) continue;
    const msgTextRaw = msg.message ?? "";
    const msgText = normalize(msgTextRaw);
    if (msgText !== text) continue;

    const msgUserLogin = msg.userLogin?.toLowerCase();
    const msgUserDisplay = msg.userDisplayName?.toLowerCase();
    if (
      msgUserLogin !== login &&
      msgUserDisplay !== login &&
      msgUserLogin !== display &&
      msgUserDisplay !== display
    ) {
      continue;
    }

    const dt = Math.abs(redeemedAt - msg.timestamp);
    if (Number.isNaN(dt) || dt > 30_000) continue;

    return { emotes: msg.parsedEmotes, chatText: msgTextRaw };
  }

  return { emotes: [] };
}

function mapEventSubRedemption(
  event: EventSubRedeemEvent,
  rewards: TwitchCustomReward[]
): TwitchRewardRedemption | null {
  const reward = rewards.find((r) => r.id === event.reward.id);
  if (!reward) return null;
  const statusUpper = event.status.toUpperCase();
  const status =
    statusUpper === "FULFILLED" || statusUpper === "CANCELED" ? statusUpper : "UNFULFILLED";
  return {
    id: event.id,
    user_login: event.user_login,
    user_display_name: event.user_name,
    reward,
    status,
    redeemed_at: event.redeemed_at,
    user_input: event.user_input || null
  };
}

function mapEventSubReward(event: EventSubRewardEvent): TwitchCustomReward {
  return {
    id: event.id,
    title: event.title,
    cost: event.cost,
    prompt: event.prompt || null,
    background_color: event.background_color,
    image: event.image,
    default_image: event.default_image,
    is_enabled: event.is_enabled,
    is_user_input_required: event.is_user_input_required,
    is_max_per_stream_enabled: event.max_per_stream.is_enabled,
    max_per_stream: event.max_per_stream.value,
    is_max_per_user_per_stream_enabled: event.max_per_user_per_stream.is_enabled,
    max_per_user_per_stream: event.max_per_user_per_stream.value,
    is_global_cooldown_enabled: event.global_cooldown.is_enabled,
    global_cooldown_seconds: event.global_cooldown.seconds,
    should_redemptions_skip_request_queue: event.should_redemptions_skip_request_queue
  };
}

const redeemTtsInFlightIds = new Set<string>();

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
  const avatarsInFlightRef = useRef<Set<string>>(new Set());
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
  }, [token.access_token]);

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
          setRewards((prev) => (prev.some((r) => r.id === reward.id) ? prev : [...prev, reward]));
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
  }, [token.access_token, broadcasterId]);

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
  }, [redemptions, broadcasterId, token.access_token]);

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

  useEffect(() => {
    const logins = Array.from(
      new Set(visibleRedemptions.map((r) => r.user_login.toLowerCase()))
    ).filter((login) => !(login in userAvatars) && !avatarsInFlightRef.current.has(login));

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
  }, [visibleRedemptions, token.access_token, userAvatars]);

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
