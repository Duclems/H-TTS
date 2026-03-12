import { useEffect, useState } from "react";
import type { TwitchTokenResponse } from "../../twitchAuth";
import {
  fetchCurrentUser,
  fetchCustomRewards,
  fetchRewardRedemptions,
  type TwitchCustomReward,
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

type Props = {
  token: TwitchTokenResponse;
  activeTab: "history" | "rewards";
  onMissingRewardVoiceChange?: (hasMissing: boolean) => void;
};

const REDEEM_REFRESH_INTERVAL_MS = 2_000;

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

        const rewardsData = await fetchCustomRewards(token.access_token, user.id);
        if (cancelled) return;

        setRewards(rewardsData);

        const allRedemptions: TwitchRewardRedemption[] = [];
        for (const reward of rewardsData) {
          const r = await fetchRewardRedemptions(token.access_token, user.id, reward.id);
          if (cancelled) return;
          allRedemptions.push(...r);
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

  // Rafraîchissement périodique de tous les rewards et redemptions
  useEffect(() => {
    if (!broadcasterId) return;

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const rewardsData = await fetchCustomRewards(token.access_token, broadcasterId);
        if (cancelled) return;
        setRewards(rewardsData);

        const allRedemptions: TwitchRewardRedemption[] = [];
        for (const reward of rewardsData) {
          const r = await fetchRewardRedemptions(token.access_token, broadcasterId, reward.id);
          if (cancelled) return;
          allRedemptions.push(...r);
        }
        setRedemptions(allRedemptions);
      } catch {
        // on garde les anciennes valeurs en cas d'erreur temporaire
      }
    }, REDEEM_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [token.access_token, broadcasterId]);

  // Lecture audio via ElevenLabs des nouvelles redemptions (fenÃªtre de 10 secondes)
  useEffect(() => {
    if (redemptions.length === 0) return;

    const PROCESSED_KEY = "h_tts_eleven_processed_redemptions";
    const raw = localStorage.getItem(PROCESSED_KEY);
    const processed = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);

    const now = Date.now();
    const newlyProcessed: string[] = [];

    for (const redemption of redemptions) {
      if (processed.has(redemption.id)) continue;
      if (!redemption.user_input || !redemption.user_input.trim()) continue;

      const redeemedAt = new Date(redemption.redeemed_at).getTime();
      if (Number.isNaN(redeemedAt)) continue;

      // On ne déclenche que pour les redemptions apparues dans les 10 dernières secondes
      if (now - redeemedAt <= 10_000) {
        const voiceConfig = loadRewardVoiceConfig(redemption.reward.id);

        // On nettoie le texte pour ElevenLabs : suppression des emotes
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

        if (!cleanedText) continue;

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[HI-TTS] Nouvelle redemption à lire via ElevenLabs", {
            id: redemption.id,
            rewardId: redemption.reward.id,
            user: redemption.user_display_name || redemption.user_login,
            rawText: redemption.user_input,
            cleanedText
          });
        }

        void speakWithElevenLabsFromText(cleanedText, voiceConfig);
      }

      processed.add(redemption.id);
      newlyProcessed.push(redemption.id);
    }

    if (newlyProcessed.length > 0) {
      localStorage.setItem(PROCESSED_KEY, JSON.stringify(Array.from(processed)));
    }
  }, [redemptions]);

  const visibleRedemptions = [...redemptions]
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

      const title = buildUniqueRewardTitle("HI-TTS Reward");

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

