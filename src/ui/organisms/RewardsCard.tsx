import { useEffect, useState } from "react";
import type { TwitchTokenResponse } from "../../twitchAuth";
import {
  fetchCurrentUser,
  fetchCustomRewardsResult,
  fetchRewardRedemptions,
  fetchRewardRedemptionsResult,
  updateRewardRedemptionStatus,
  type TwitchCustomReward,
  type TwitchHelixErr,
  type TwitchRewardRedemption,
  createCustomReward,
  fetchUserByLogin
} from "../../twitchApi";
import {
  startTwitchChatLogger,
  addTwitchChatListener,
  type ChatMessageWithEmotes,
  type ParsedEmote
} from "../../twitchChat";
import { speakWithElevenLabsFromText } from "../../elevenLabsApi";
import { loadRewardVoiceConfig } from "../../rewardVoiceConfig";
import { RewardVoiceModal } from "./RewardVoiceModal";
import { useI18n } from "../context/I18nContext";
import { logDebug } from "../../debugLog";

type Props = {
  token: TwitchTokenResponse;
  activeTab: "history" | "rewards";
  onMissingRewardVoiceChange?: (hasMissing: boolean) => void;
};

const REDEEM_REFRESH_INTERVAL_MS = 5_000;
const POLL_BACKOFF_MAX_MS = 120_000;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Délai avant prochaine tentative après erreur Helix / réseau. */
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

/** Rewards pour lesquels on interroge les redemptions (évite N appels pour les rewards désactivés). */
function rewardsActiveForPoll(all: TwitchCustomReward[]): TwitchCustomReward[] {
  return all.filter((r) => r.is_enabled);
}

const AUDIO_COMPLETED_KEY = "h_tts_redeem_audio_completed_ids";
const FULFILL_COMPLETED_KEY = "h_tts_redeem_fulfill_completed_ids";
const RECENT_FULFILLED_KEY = "h_tts_recent_fulfilled_redemptions";
const RECENT_FULFILLED_MAX = 5;

function readStringIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function persistStringIdSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
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

function pushRecentFulfilledRedemption(redemption: TwitchRewardRedemption) {
  try {
    const prev = readRecentFulfilledRedemptions().filter((r) => r.id !== redemption.id);
    const next = [redemption, ...prev].slice(0, RECENT_FULFILLED_MAX);
    localStorage.setItem(RECENT_FULFILLED_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export const RewardsCard = ({ token, activeTab, onMissingRewardVoiceChange }: Props) => {
  const { t } = useI18n();
  const EMOTES_CACHE_KEY = "h_tts_emotes_by_redemption";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<TwitchCustomReward[]>([]);
  const [redemptions, setRedemptions] = useState<TwitchRewardRedemption[]>([]);
  const [settingsRewardId, setSettingsRewardId] = useState<string | null>(null);
  const [rewardsMissingVoice, setRewardsMissingVoice] = useState<Record<string, boolean>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessageWithEmotes[]>([]);
  const [emoteMatches, setEmoteMatches] = useState<
    Record<string, { chatText?: string; emotes: ParsedEmote[] }>
  >({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string | null>>({});
  const [recentFulfilledRedemptions, setRecentFulfilledRedemptions] = useState<
    TwitchRewardRedemption[]
  >(() => readRecentFulfilledRedemptions());

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const user = await fetchCurrentUser(token.access_token);
        if (!user) {
          setError(t("rewards.errorProfile"));
          return;
        }

        setBroadcasterId(user.id);

        // Lance un logger minimal du chat IRC dans la console (uniquement les messages du chat)
        startTwitchChatLogger({
          channelLogin: user.login
        });

        addTwitchChatListener((msg) => {
          setChatMessages((prev) => {
            const next = [...prev, msg];
            if (next.length > 200) {
              next.shift();
            }
            return next;
          });
        });

        let rewardsData: TwitchCustomReward[] | null = null;
        for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
          const rr = await fetchCustomRewardsResult(token.access_token, user.id);
          if (cancelled) return;
          if (rr.ok) {
            rewardsData = rr.data;
            break;
          }
          if (attempt < 5) {
            await sleepMs(pollBackoffDelayMs(rr, attempt + 1));
          }
        }
        if (!rewardsData) {
          setError(t("rewards.errorFetch"));
          return;
        }

        setRewards(rewardsData);

        const allRedemptions: TwitchRewardRedemption[] = [];
        for (const reward of rewardsActiveForPoll(rewardsData)) {
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
            if (attempt < 5) {
              await sleepMs(pollBackoffDelayMs(rr, attempt + 1));
            }
          }
          if (chunk) {
            allRedemptions.push(...chunk);
          } else {
            logDebug({
              timestamp: Date.now(),
              type: "reward",
              source: "rewards-initial",
              message: "Giving up on redemptions for one reward after retries.",
              details: { rewardId: reward.id },
            });
          }
        }
        setRedemptions(allRedemptions);
      } catch (e) {
        setError(t("rewards.errorFetch"));
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

  // Chargement initial du cache d'emotes pour les redeems
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EMOTES_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, { chatText?: string; emotes: ParsedEmote[] }>;
      if (parsed && typeof parsed === "object") {
        setEmoteMatches(parsed);
      }
    } catch {
      // en cas d'erreur de parsing, on ignore simplement le cache
    }
  }, []);

  // Rafraîchissement périodique : liste complète des rewards en UI, mais redemptions uniquement pour les rewards actifs (is_enabled).
  // Backoff (429 / 5xx / réseau) via setTimeout récursif au lieu d’un intervalle fixe.
  useEffect(() => {
    if (!broadcasterId) return;

    let cancelled = false;
    let timeoutId = 0;
    let consecutiveFailures = 0;

    const schedule = (delayMs: number) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => void tick(), delayMs);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const rewardsRes = await fetchCustomRewardsResult(token.access_token, broadcasterId);
        if (cancelled) return;
        if (!rewardsRes.ok) {
          consecutiveFailures += 1;
          logDebug({
            timestamp: Date.now(),
            type: "reward",
            source: "rewards-poll",
            message: "Helix error while fetching custom rewards; backing off.",
            details: {
              status: rewardsRes.status,
              network: rewardsRes.network ?? false,
              retryAfterMs: rewardsRes.retryAfterMs,
              nextDelayMs: pollBackoffDelayMs(rewardsRes, consecutiveFailures),
            },
          });
          schedule(pollBackoffDelayMs(rewardsRes, consecutiveFailures));
          return;
        }

        consecutiveFailures = 0;
        setRewards(rewardsRes.data);

        const allRedemptions: TwitchRewardRedemption[] = [];
        for (const reward of rewardsActiveForPoll(rewardsRes.data)) {
          const redRes = await fetchRewardRedemptionsResult(
            token.access_token,
            broadcasterId,
            reward.id
          );
          if (cancelled) return;
          if (!redRes.ok) {
            consecutiveFailures += 1;
            logDebug({
              timestamp: Date.now(),
              type: "reward",
              source: "rewards-poll",
              message: "Helix error while fetching redemptions; backing off.",
              details: {
                rewardId: reward.id,
                status: redRes.status,
                network: redRes.network ?? false,
                retryAfterMs: redRes.retryAfterMs,
                nextDelayMs: pollBackoffDelayMs(redRes, consecutiveFailures),
              },
            });
            schedule(pollBackoffDelayMs(redRes, consecutiveFailures));
            return;
          }
          allRedemptions.push(...redRes.data);
        }

        consecutiveFailures = 0;
        setRedemptions(allRedemptions);
        schedule(REDEEM_REFRESH_INTERVAL_MS);
      } catch (error) {
        consecutiveFailures += 1;
        logDebug({
          timestamp: Date.now(),
          type: "reward",
          source: "rewards-poll",
          message: "Unexpected error while refreshing Twitch rewards/redemptions.",
          details:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : String(error),
        });
        const syntheticErr: TwitchHelixErr = { ok: false, status: 0, network: true };
        schedule(pollBackoffDelayMs(syntheticErr, consecutiveFailures));
      }
    };

    schedule(REDEEM_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [token.access_token, broadcasterId]);

  // Lecture audio via ElevenLabs des nouvelles redemptions (fenêtre de 30 secondes)
  useEffect(() => {
    if (redemptions.length === 0 || !broadcasterId) return;

    let cancelled = false;

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
          details: {
            redemptionId: redemption.id,
            rewardId: redemption.reward.id,
          },
        });
        return false;
      }

      const fulfilled: TwitchRewardRedemption = { ...redemption, status: "FULFILLED" };
      pushRecentFulfilledRedemption(fulfilled);
      setRecentFulfilledRedemptions(readRecentFulfilledRedemptions());

      logDebug({
        timestamp: Date.now(),
        type: "redeem",
        source: "redeem-fulfill",
        message: "Twitch redemption marked as FULFILLED after TTS playback.",
        details: {
          redemptionId: redemption.id,
          rewardId: redemption.reward.id,
        },
      });
      return true;
    };

    const run = async () => {
      const audioDone = readStringIdSet(AUDIO_COMPLETED_KEY);
      const fulfillDone = readStringIdSet(FULFILL_COMPLETED_KEY);

      for (const redemption of redemptions) {
        if (cancelled) return;

        if (fulfillDone.has(redemption.id)) {
          continue;
        }

        if (audioDone.has(redemption.id)) {
          const ok = await fulfillRedemption(redemption);
          if (ok) {
            fulfillDone.add(redemption.id);
            persistStringIdSet(FULFILL_COMPLETED_KEY, fulfillDone);
          }
          continue;
        }

        if (!redemption.user_input || !redemption.user_input.trim()) {
          audioDone.add(redemption.id);
          fulfillDone.add(redemption.id);
          persistStringIdSet(AUDIO_COMPLETED_KEY, audioDone);
          persistStringIdSet(FULFILL_COMPLETED_KEY, fulfillDone);
          continue;
        }

        const redeemedAt = new Date(redemption.redeemed_at).getTime();
        if (Number.isNaN(redeemedAt)) continue;

        const now = Date.now();
        const isFresh = now - redeemedAt <= 30_000;

        if (!isFresh) {
          // Ne pas rejouer le TTS pour d'anciennes redemptions encore listées comme UNFULFILLED.
          audioDone.add(redemption.id);
          fulfillDone.add(redemption.id);
          persistStringIdSet(AUDIO_COMPLETED_KEY, audioDone);
          persistStringIdSet(FULFILL_COMPLETED_KEY, fulfillDone);
          continue;
        }

        const voiceConfig = loadRewardVoiceConfig(redemption.reward.id);

        const { emotes, chatText } = getEmoteMatchForRedemption(redemption);
        const baseText = (chatText ?? redemption.user_input ?? "").toString();

        const cleanedText =
          emotes.length === 0
            ? baseText
            : (() => {
                let cursor = 0;
                let result = "";

                const sorted = [...emotes]
                  .flatMap((e) => e.positions.map((p) => ({ start: p.start, end: p.end })))
                  .sort((a, b) => a.start - b.start);

                sorted.forEach(({ start, end }) => {
                  if (start > cursor) {
                    result += baseText.slice(cursor, start);
                  }
                  cursor = end + 1;
                });

                if (cursor < baseText.length) {
                  result += baseText.slice(cursor);
                }

                return result.replace(/\s+/g, " ").trim();
              })();

        if (!cleanedText) {
          logDebug({
            timestamp: Date.now(),
            type: "redeem",
            source: "redeem-skip",
            message: "Redemption skipped: no usable text after cleanup.",
            details: {
              redemptionId: redemption.id,
              rewardId: redemption.reward.id,
            },
          });
          audioDone.add(redemption.id);
          fulfillDone.add(redemption.id);
          persistStringIdSet(AUDIO_COMPLETED_KEY, audioDone);
          persistStringIdSet(FULFILL_COMPLETED_KEY, fulfillDone);
          continue;
        }

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
            text: cleanedText,
          },
        });

        const tts = await speakWithElevenLabsFromText(cleanedText, voiceConfig);
        if (!tts.playedToEnd) {
          continue;
        }

        audioDone.add(redemption.id);
        persistStringIdSet(AUDIO_COMPLETED_KEY, audioDone);

        const ok = await fulfillRedemption(redemption);
        if (ok) {
          fulfillDone.add(redemption.id);
          persistStringIdSet(FULFILL_COMPLETED_KEY, fulfillDone);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [redemptions, broadcasterId, token.access_token]);

  const byId = new Map<string, TwitchRewardRedemption>();
  for (const r of redemptions) {
    byId.set(r.id, r);
  }
  for (const r of recentFulfilledRedemptions) {
    if (!byId.has(r.id)) {
      byId.set(r.id, r);
    }
  }

  const visibleRedemptions = [...byId.values()]
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.redeemed_at).getTime();
      const tb = new Date(b.redeemed_at).getTime();
      if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
      return tb - ta; // plus récents en premier
    })
    .slice(0, 5);

  // Charge les avatars des utilisateurs présents dans les 5 derniers redemptions visibles
  useEffect(() => {
    const logins = Array.from(
      new Set(visibleRedemptions.map((r) => r.user_login.toLowerCase()))
    ).filter((login) => !(login in userAvatars));

    if (logins.length === 0) return;

    let cancelled = false;

    const load = async () => {
      try {
        await Promise.all(
          logins.map(async (login) => {
            const user = await fetchUserByLogin(token.access_token, login);
            if (cancelled) return;
            setUserAvatars((prev) => ({
              ...prev,
              [login]: user?.profile_image_url ?? null
            }));
          })
        );
      } catch {
        // en cas d'erreur API, on garde simplement les initiales
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [visibleRedemptions, token.access_token, userAvatars]);

  // Vérifie quels rewards n'ont pas de voix configurée
  useEffect(() => {
    if (rewards.length === 0) {
      setRewardsMissingVoice({});
      if (onMissingRewardVoiceChange) {
        onMissingRewardVoiceChange(false);
      }
      return;
    }

    const next: Record<string, boolean> = {};
    for (const reward of rewards) {
      const cfg = loadRewardVoiceConfig(reward.id);
      const missing = !cfg || !cfg.voiceId || !cfg.voiceId.trim();
      next[reward.id] = missing;
    }
    setRewardsMissingVoice(next);
    if (onMissingRewardVoiceChange) {
      const hasMissing = Object.values(next).some(Boolean);
      onMissingRewardVoiceChange(hasMissing);
    }
  }, [rewards, settingsRewardId, onMissingRewardVoiceChange]);

  const getEmoteMatchForRedemption = (
    redemption: TwitchRewardRedemption
  ): { emotes: ParsedEmote[]; chatText?: string } => {
    const cached = emoteMatches[redemption.id];
    if (cached) return cached;

    if (!chatMessages.length) return { emotes: [] };
    const textRaw = (redemption.user_input ?? "").trim();
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    const text = normalize(textRaw);
    const login = redemption.user_login.toLowerCase();
    const display = redemption.user_display_name?.toLowerCase();
    const rewardId = redemption.reward.id;
    const redeemedAt = new Date(redemption.redeemed_at).getTime();

    let bestEmotes: ParsedEmote[] = [];
    let bestText: string | undefined;

    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      const msg = chatMessages[i];
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

      bestEmotes = msg.parsedEmotes;
      bestText = msgTextRaw;
      break;
    }

    const match = { emotes: bestEmotes, chatText: bestText };

    if (bestEmotes.length > 0) {
      setEmoteMatches((prev) => {
        const next = { ...prev, [redemption.id]: match };
        try {
          localStorage.setItem(EMOTES_CACHE_KEY, JSON.stringify(next));
        } catch {
          // si le localStorage est plein ou indisponible, on ignore
        }
        return next;
      });
    }

    return match;
  };

  const renderMessageWithEmotes = (text: string, emotes: ParsedEmote[]) => {
    if (!text || emotes.length === 0) return text;

    const segments: React.ReactNode[] = [];
    let cursor = 0;

    const sorted = [...emotes]
      .flatMap((e) => e.positions.map((p) => ({ emote: e, start: p.start, end: p.end })))
      .sort((a, b) => a.start - b.start);

    sorted.forEach(({ emote, start, end }, index) => {
      if (start > cursor) {
        segments.push(text.slice(cursor, start));
      }

      const key = `${emote.id}-${index}-${start}`;
      segments.push(
        <img
          key={key}
          src={emote.urls["2x"]}
          alt={emote.code}
          title={emote.code}
          style={{
            width: 20,
            height: 20,
            verticalAlign: "middle",
            margin: "0 2px",
            borderRadius: 4
          }}
        />
      );

      cursor = end + 1;
    });

    if (cursor < text.length) {
      segments.push(text.slice(cursor));
    }

    return segments;
  };

  const buildUniqueRewardTitle = (baseTitle: string): string => {
    const existingTitles = rewards.map((r) => r.title);
    if (!existingTitles.includes(baseTitle)) return baseTitle;

    let suffix = 1;
    while (suffix < 1000) {
      const candidate = `${baseTitle} (${suffix})`;
      if (!existingTitles.includes(candidate)) return candidate;
      suffix += 1;
    }
    return `${baseTitle} (${Date.now()})`;
  };

  const handleCreateReward = async () => {
    if (!broadcasterId) return;

    try {
      setCreating(true);
      setError(null);

      const title = buildUniqueRewardTitle("Hi-TTS Reward");

      const reward = await createCustomReward(token.access_token, broadcasterId, {
        title,
        cost: 100,
        prompt: t("rewards.rewardPrompt"),
        is_enabled: true,
        is_user_input_required: true,
        background_color: "#9146FF",
        is_global_cooldown_enabled: true,
        global_cooldown_seconds: 300,
        is_max_per_stream_enabled: true,
        max_per_stream: 50,
        is_max_per_user_per_stream_enabled: true,
        max_per_user_per_stream: 5,
        should_redemptions_skip_request_queue: true
      });

      if (!reward) {
        setError(t("rewards.errorCreate"));
        return;
      }

      setRewards((prev) => [...prev, reward]);
      const r = await fetchRewardRedemptions(token.access_token, broadcasterId, reward.id);
      setRedemptions((prev) => [...prev, ...r]);
    } catch {
      setError(t("rewards.errorCreateShort"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="card">
      {loading && !error && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2.2rem 1rem 1.6rem",
            gap: "0.6rem"
          }}
        >
          <img
            src="/logos/hi-tts-animated.svg"
            alt={t("rewards.loadingAlt")}
            style={{ width: "112px", height: "112px", opacity: 0.95 }}
          />
        </div>
      )}
      {error && <p className="error-text">{error}</p>}

      {!loading && (
        <>
          {activeTab === "rewards" && (
            <div className="rewards-list-container">
              <button
                type="button"
                className="twitch-button"
                style={{ marginTop: 0 }}
                onClick={handleCreateReward}
                disabled={creating || !broadcasterId}
              >
                {creating ? t("rewards.creating") : t("rewards.createCta")}
              </button>

              {!creating && rewards.length === 0 && (
                <div
                  style={{
                    marginTop: "1.2rem",
                    borderRadius: "0.9rem",
                    padding: "1.2rem 0.9rem",
                    border: "1px dashed var(--border)",
                    backgroundColor: "rgba(10, 5, 4, 0.9)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.6rem"
                  }}
                >
                  <img
                    src="/logos/hi-tts-animated.svg"
                    alt={t("rewards.animationAlt")}
                    style={{ width: "104px", height: "104px"}}
                  />
                  <p
                    className="card-text"
                    style={{ textAlign: "center", fontSize: "0.8rem", maxWidth: "260px" }}
                  >
                    {t("rewards.empty")}
                  </p>
                </div>
              )}

              {rewards.map((reward) => {
                const img =
                  reward.image?.url_2x ??
                  reward.default_image?.url_2x ??
                  reward.default_image?.url_1x;
                return (
                  <div key={reward.id} className="panel">
                    <div
                      style={{
                        display: "flex",
                        gap: "0.6rem",
                        alignItems: "center",
                        flexWrap: "wrap"
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: reward.background_color || "#2a1a0f",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden"
                        }}
                      >
                        {img && (
                          <img
                            src={img}
                            alt={reward.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{reward.title}</div>
                        <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
                          {reward.cost} {t("rewards.points")}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={
                          rewardsMissingVoice[reward.id]
                            ? "twitch-button twitch-button-voice-error"
                            : "twitch-button"
                        }
                        style={{
                          marginTop: 0,
                          width: "auto",
                          padding: "0.4rem 0.75rem",
                          fontSize: "0.8rem"
                        }}
                        onClick={() => setSettingsRewardId(reward.id)}
                      >
                        {t("rewards.settings")}
                      </button>
                    </div>

                    {reward.prompt && (
                      <p className="card-text" style={{ marginTop: "0.4rem" }}>
                        {reward.prompt}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "history" && (
            <>
              <div className="rewards-history-container">
                {!loading && visibleRedemptions.length === 0 && (
                  <div
                    style={{
                      borderRadius: "0.9rem",
                      padding: "1.4rem 1rem",
                      border: "1px dashed var(--border)",
                      backgroundColor: "rgba(10, 5, 4, 0.9)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.6rem"
                    }}
                  >
                    <img
                      src="/logos/hi-tts-animated.svg"
                      alt={t("rewards.animationAlt")}
                      style={{ width: "104px", height: "104px", opacity: 0.9 }}
                    />
                    <p
                      className="card-text"
                      style={{ textAlign: "center", fontSize: "0.8rem", maxWidth: "260px" }}
                    >
                      {t("rewards.historyEmpty")}
                    </p>
                  </div>
                )}

                {!loading &&
                  visibleRedemptions.length > 0 &&
                  visibleRedemptions.map((r) => {
                    const date = new Date(r.redeemed_at);
                    const user = r.user_display_name || r.user_login;
                    const initial = user.charAt(0).toUpperCase();
                    const emotes = getEmoteMatchForRedemption(r);
                    const loginKey = r.user_login.toLowerCase();
                    const avatarUrl = userAvatars[loginKey] ?? null;
                    return (
                      <div key={r.id} className="panel rewards-history-item">
                        <div className="rewards-history-item-main">
                          <div className="rewards-history-avatar">
                            {avatarUrl ? <img src={avatarUrl} alt={user} /> : <span>{initial}</span>}
                          </div>
                          <div className="rewards-history-text">
                            <div className="rewards-history-title">
                              {user} a {r.reward.title}
                            </div>
                            <div className="rewards-history-meta">
                              {date.toLocaleDateString()} {date.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        {r.user_input && (
                          <p className="rewards-history-message">
                            {renderMessageWithEmotes(
                              emotes.chatText ?? r.user_input,
                              emotes.emotes
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </>
      )}

      {settingsRewardId && (() => {
        const reward = rewards.find((r) => r.id === settingsRewardId);
        if (!reward) return null;
        return (
          <RewardVoiceModal
            rewardId={reward.id}
            rewardTitle={reward.title}
            onClose={() => setSettingsRewardId(null)}
          />
        );
      })()}
    </section>
  );
};

