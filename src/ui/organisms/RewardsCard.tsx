import { useEffect, useMemo, useRef, useState } from "react";
import type { TwitchTokenResponse } from "../../twitchAuth";
import { HIARTE_HI_TTS_PROJECT_URL } from "../../config";
import {
  fetchCurrentUser,
  fetchCustomRewardsResult,
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
  stopTwitchChatLogger,
  addTwitchChatListener,
  removeTwitchChatListener,
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
import { RewardVoiceModal } from "./RewardVoiceModal";
import { useI18n } from "../context/I18nContext";
import { logDebug } from "../../debugLog";
import {
  STORAGE_KEY_REDEEM_AUDIO_COMPLETED as AUDIO_COMPLETED_KEY,
  STORAGE_KEY_REDEEM_FULFILL_COMPLETED as FULFILL_COMPLETED_KEY,
  STORAGE_KEY_RECENT_FULFILLED_REDEMPTIONS as RECENT_FULFILLED_KEY,
  STORAGE_KEY_EMOTES_BY_REDEMPTION as EMOTES_CACHE_KEY
} from "../../storageKeys";

type Props = {
  token: TwitchTokenResponse;
  activeTab: "history" | "rewards";
  onMissingRewardVoiceChange?: (hasMissing: boolean) => void;
};

const POLL_BACKOFF_MAX_MS = 120_000;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readRootCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
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

const RECENT_FULFILLED_MAX = 5;

/** Évite plusieurs appels ElevenLabs pour le même redeem si l’effet se relance pendant le `await` (poll, Strict Mode, etc.). */
const redeemTtsInFlightIds = new Set<string>();

const REDEEM_FP_SEP = "\u001f";
const REDEEM_ROW_SEP = "\u001e";

/**
 * Empreinte stable (string) des redemptions. Utilisée pour détecter si Helix
 * renvoie le même lot et éviter un `setRedemptions` inutile (qui relancerait
 * l'effet TTS + les recalculs dérivés).
 *
 * On garde un string plutôt qu'un hash numérique pour l'absence totale de
 * risque de collision. Le coût est amorti en stockant le dernier fingerprint
 * dans une ref → un seul calcul par tick de polling (au lieu de 2).
 */
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

/**
 * Calcule la nouvelle liste (triée, capée) + persiste en localStorage en un
 * seul passage. Accepte la liste précédente en argument pour être utilisable
 * dans un setState updater (pas de relecture de localStorage).
 */
function appendRecentFulfilledRedemption(
  prev: TwitchRewardRedemption[],
  redemption: TwitchRewardRedemption
): TwitchRewardRedemption[] {
  const filtered = prev.filter((r) => r.id !== redemption.id);
  const next = [redemption, ...filtered].slice(0, RECENT_FULFILLED_MAX);
  try {
    localStorage.setItem(RECENT_FULFILLED_KEY, JSON.stringify(next));
  } catch {
    // si le localStorage est plein/indisponible, on garde quand même le state
  }
  return next;
}

type EmoteMatch = { emotes: ParsedEmote[]; chatText?: string };

/**
 * Fonction pure : cherche, pour une redemption, le message IRC associé (même texte,
 * même utilisateur, même reward, dans une fenêtre de 30 s) afin d'en extraire les emotes.
 * N'effectue aucun side-effect (utilisable en phase de rendu).
 */
function computeEmoteMatch(
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

const CHAT_BUFFER_MAX = 200;

/**
 * Convertit un event EventSub `channel_points_custom_reward_redemption.*` en
 * `TwitchRewardRedemption` (format Helix). Le payload EventSub ne contient
 * qu'un reward minimal ; on complète depuis la liste `rewards` connue. Si le
 * reward est inconnu (créé à l'extérieur avant réception de l'event
 * `custom_reward.add` correspondant), on retourne `null` → l'event sera
 * ignoré mais le prochain fetch Helix (ou event reward.add) rattrapera.
 */
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

/**
 * Reconstruit un `TwitchCustomReward` à partir d'un event EventSub
 * `custom_reward.*`. Les types sont assez proches (Twitch réutilise les mêmes
 * noms de champs), seules les formes `max_per_stream` / `global_cooldown` /
 * `max_per_user_per_stream` sont nichées côté EventSub.
 */
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

export const RewardsCard = ({ token, activeTab, onMissingRewardVoiceChange }: Props) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<TwitchCustomReward[]>([]);
  const [redemptions, setRedemptions] = useState<TwitchRewardRedemption[]>([]);
  const [settingsRewardId, setSettingsRewardId] = useState<string | null>(null);
  const [rewardsMissingVoice, setRewardsMissingVoice] = useState<Record<string, boolean>>({});
  // chatMessages n'est jamais rendu : on garde les messages dans une ref pour
  // éviter un re-render complet du composant à chaque ligne de chat.
  // `chatVersion` est incrémenté UNIQUEMENT pour les messages susceptibles de
  // matcher une redemption (rewardId + emotes), ce qui déclenche le recalcul
  // du cache d'emotes sans bruit.
  const chatMessagesRef = useRef<ChatMessageWithEmotes[]>([]);
  const [chatVersion, setChatVersion] = useState(0);
  const [emoteMatches, setEmoteMatches] = useState<Record<string, EmoteMatch>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string | null>>({});
  // File des fetches en cours pour éviter les doubles appels quand l'effet est
  // relancé avant le retour réseau (cas fréquent : state mis à jour pour
  // d'autres raisons, visibleRedemptions recalculé).
  const avatarsInFlightRef = useRef<Set<string>>(new Set());
  const [recentFulfilledRedemptions, setRecentFulfilledRedemptions] = useState<
    TwitchRewardRedemption[]
  >(() => readRecentFulfilledRedemptions());
  // Sets persistés en localStorage, lus une seule fois à l'init et gardés en ref.
  const audioDoneRef = useRef<Set<string>>(new Set());
  const fulfillDoneRef = useRef<Set<string>>(new Set());
  // Miroir ref de `rewards` pour que les handlers EventSub puissent résoudre le
  // reward associé à un event sans recréer la connexion WS à chaque update.
  const rewardsRef = useRef<TwitchCustomReward[]>([]);
  // Dernier fingerprint des redemptions appliquées à `setRedemptions` → utile
  // sur les resynchronisations massives (fetch initial + refetch après
  // reconnect EventSub) pour éviter un rendu inutile si les données sont
  // strictement identiques. Sentinel `null` = jamais set.
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
    let cancelled = false;

    const onTwitchChatMessage = (msg: ChatMessageWithEmotes) => {
      const buffer = chatMessagesRef.current;
      if (buffer.length >= CHAT_BUFFER_MAX) {
        // Évite l'allocation d'un nouveau tableau à chaque message : on mute
        // le buffer (qui ne sert qu'au matching, pas au rendu).
        buffer.shift();
      }
      buffer.push(msg);

      // Seuls les messages liés à un reward ET porteurs d'emotes peuvent
      // produire un match : on ne bump la version que dans ce cas.
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
          setError(t("rewards.errorProfile"));
          return;
        }
        if (cancelled) return;

        setBroadcasterId(user.id);

        // Lance un logger minimal du chat IRC dans la console (uniquement les messages du chat)
        startTwitchChatLogger({
          channelLogin: user.login
        });
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
          if (attempt < 5) {
            await sleepMs(pollBackoffDelayMs(rr, attempt + 1));
          }
        }
        const rewardsList = rewardsData ?? [];
        if (!rewardsData && lastRewardsErr) {
          // Ancien comportement de `fetchCustomRewards` : réponse non-ok → liste vide, pas d’erreur UI.
          // (403 / scope / client_id évite souvent d’afficher des rewards « manageable » sans être une panne.)
          logDebug({
            timestamp: Date.now(),
            type: "reward",
            source: "rewards-initial",
            message:
              "Custom rewards Helix failed after retries; using empty list (legacy-compatible).",
            details: {
              status: lastRewardsErr.status,
              network: lastRewardsErr.network ?? false,
              retryAfterMs: lastRewardsErr.retryAfterMs,
            },
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
          details: e instanceof Error ? { name: e.name, message: e.message } : String(e),
        });
        setRewards([]);
        setRedemptions([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      removeTwitchChatListener(onTwitchChatMessage);
      // Coupe la connexion IRC : si l'utilisateur relogue sur un autre compte,
      // on ouvrira un nouveau client sur le bon channel (voir twitchChat.ts).
      stopTwitchChatLogger();
    };
  }, [token.access_token]);

  // Chargement initial du cache d'emotes pour les redeems
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EMOTES_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, EmoteMatch>;
      if (parsed && typeof parsed === "object") {
        setEmoteMatches(parsed);
      }
    } catch {
      // en cas d'erreur de parsing, on ignore simplement le cache
    }
  }, []);

  // Miroir ref de `rewards` → permet aux handlers EventSub (closures stables
  // recréées uniquement sur changement de token / broadcaster) de résoudre le
  // reward associé à un event sans dépendre de l'état React courant.
  useEffect(() => {
    rewardsRef.current = rewards;
  }, [rewards]);

  // Abonnement EventSub WebSocket : zéro polling Helix pendant la session.
  // Couvre les events :
  //   - channel.channel_points_custom_reward_redemption.add/update
  //   - channel.channel_points_custom_reward.add/update/remove
  // Le fetch initial (useEffect [token.access_token]) alimente l'état au
  // démarrage ; EventSub prend ensuite le relais. Sur reconnect après perte
  // WS, on relance un fetch complet pour rattraper les events manqués.
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
          if (redRes.ok) {
            allRedemptions.push(...redRes.data);
          }
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
      } catch (error) {
        logDebug({
          timestamp: Date.now(),
          type: "reward",
          source: "eventsub-resync",
          message: "Helix resync failed after EventSub reconnect.",
          details:
            error instanceof Error ? { name: error.name, message: error.message } : String(error)
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
                setRecentFulfilledRedemptions((prev) =>
                  appendRecentFulfilledRedemption(prev, mapped)
                );
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

  // Lecture audio via ElevenLabs des nouvelles redemptions (fenêtre de 30 secondes)
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
          details: {
            redemptionId: redemption.id,
            rewardId: redemption.reward.id,
          },
        });
        return false;
      }

      const fulfilled: TwitchRewardRedemption = { ...redemption, status: "FULFILLED" };
      setRecentFulfilledRedemptions((prev) => appendRecentFulfilledRedemption(prev, fulfilled));

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
      // Delta filtering : on ne parcourt que les redemptions qui ne sont pas
      // encore complètement traitées (fulfill + audio). Les sets sont lus
      // depuis une ref, pas depuis localStorage (cf. effet dédié plus haut).
      const pending = redemptions.filter(
        (r) => !fulfillDoneRef.current.has(r.id)
      );
      if (pending.length === 0) return;

      // Lecture unique des voice configs pour tout le batch (évite un
      // JSON.parse localStorage par redemption).
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
          // Ne pas rejouer le TTS pour d'anciennes redemptions encore listées comme UNFULFILLED.
          markAudioDone(redemption.id);
          markFulfillDone(redemption.id);
          continue;
        }

        const voiceConfig = voiceConfigs[redemption.reward.id] ?? null;

        const { emotes, chatText } = computeEmoteMatch(
          redemption,
          chatMessagesRef.current
        );
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
                  if (start > cursor) {
                    result += baseText.slice(cursor, start);
                  }
                  cursor = end + 1;
                }

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
          markAudioDone(redemption.id);
          markFulfillDone(redemption.id);
          continue;
        }

        if (redeemTtsInFlightIds.has(redemption.id)) {
          continue;
        }
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
              text: cleanedText,
            },
          });

          const tts = await speakWithElevenLabsFromText(cleanedText, voiceConfig);
          if (!tts.playedToEnd) {
            continue;
          }

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
    for (const r of redemptions) {
      byId.set(r.id, r);
    }
    for (const r of recentFulfilledRedemptions) {
      if (!byId.has(r.id)) {
        byId.set(r.id, r);
      }
    }
    return [...byId.values()]
      .sort((a, b) => {
        const ta = new Date(a.redeemed_at).getTime();
        const tb = new Date(b.redeemed_at).getTime();
        if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
        return tb - ta; // plus récents en premier
      })
      .slice(0, 5);
  }, [redemptions, recentFulfilledRedemptions]);

  // Charge les avatars des utilisateurs présents dans les 5 derniers redemptions visibles.
  // `userAvatars` reste dans les deps : le filtre `!(login in userAvatars)`
  // garantit qu'après un set, la relance de l'effet filtre immédiatement les
  // logins déjà résolus (logins = [] → return). `avatarsInFlightRef` bloque
  // les doubles fetches quand l'effet est relancé pendant un await.
  useEffect(() => {
    const logins = Array.from(
      new Set(visibleRedemptions.map((r) => r.user_login.toLowerCase()))
    ).filter(
      (login) => !(login in userAvatars) && !avatarsInFlightRef.current.has(login)
    );

    if (logins.length === 0) return;

    let cancelled = false;
    for (const login of logins) {
      avatarsInFlightRef.current.add(login);
    }

    void Promise.all(
      logins.map(async (login) => {
        try {
          const user = await fetchUserByLogin(token.access_token, login);
          if (cancelled) return;
          const url = user?.profile_image_url ?? null;
          setUserAvatars((prev) => ({ ...prev, [login]: url }));
        } catch {
          // en cas d'erreur API, on garde simplement les initiales
        } finally {
          avatarsInFlightRef.current.delete(login);
        }
      })
    );

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

    const all = loadAllRewardVoiceConfigs();
    const next: Record<string, boolean> = {};
    for (const reward of rewards) {
      const cfg = all[reward.id];
      const missing = !cfg || !cfg.voiceId || !cfg.voiceId.trim();
      next[reward.id] = missing;
    }
    setRewardsMissingVoice(next);
    if (onMissingRewardVoiceChange) {
      const hasMissing = Object.values(next).some(Boolean);
      onMissingRewardVoiceChange(hasMissing);
    }
  }, [rewards, settingsRewardId, onMissingRewardVoiceChange]);

  // Lookup pur pour le rendu : aucun side-effect. Le cache est alimenté par
  // l'effet dédié ci-dessous (éviter "setState during render").
  const getEmoteMatchForRedemption = (
    redemption: TwitchRewardRedemption
  ): EmoteMatch => {
    const cached = emoteMatches[redemption.id];
    if (cached) return cached;
    return computeEmoteMatch(redemption, chatMessagesRef.current);
  };

  // Alimente le cache d'emotes après rendu. On écoute `visibleRedemptions`
  // (et pas seulement `redemptions`) pour couvrir aussi les redeems récemment
  // fulfillés : si le message IRC associé arrive APRÈS le fulfillment, Helix
  // ne renvoie plus la redemption dans `redemptions` mais elle vit dans
  // `recentFulfilledRedemptions`. Sans ce chemin, le match se verrait à
  // l'écran via le fallback en direct (chatMessagesRef) mais ne serait
  // jamais persisté → au prochain lancement, buffer IRC vide, plus d'emotes.
  useEffect(() => {
    if (visibleRedemptions.length === 0) return;
    const messages = chatMessagesRef.current;
    if (messages.length === 0) return;

    const updates: Record<string, EmoteMatch> = {};
    for (const r of visibleRedemptions) {
      if (emoteMatches[r.id]) continue;
      const match = computeEmoteMatch(r, messages);
      if (match.emotes.length > 0) {
        updates[r.id] = match;
      }
    }

    if (Object.keys(updates).length === 0) return;

    setEmoteMatches((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(EMOTES_CACHE_KEY, JSON.stringify(next));
      } catch {
        // si le localStorage est plein ou indisponible, on ignore
      }
      return next;
    });
    // `emoteMatches` est lu mais volontairement hors deps : il est setté par
    // cet effet lui-même, sa présence dans les deps créerait une boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRedemptions, chatVersion]);

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
          className="rewards-emote-inline"
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
        background_color: readRootCssVar("--twitch-purple", "#9146ff"),
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

      // Un reward fraîchement créé n'a par définition aucune redemption :
      // on évite le round-trip Helix inutile. Le poll régulier prendra le relais.
      setRewards((prev) => [...prev, reward]);
    } catch {
      setError(t("rewards.errorCreateShort"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="card">
      {loading && !error && (
        <div className="rewards-splash">
          <a
            href={HIARTE_HI_TTS_PROJECT_URL}
            target="_blank"
            rel="noreferrer"
            className="hi-tts-project-link"
            aria-label={t("about.footerApp")}
          >
            <img
              src="/logos/hi-tts-animated.svg"
              alt=""
              className="rewards-splash-logo"
            />
          </a>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}

      {!loading && (
        <>
          {activeTab === "rewards" && (
            <div className="rewards-list-container">
              <button
                type="button"
                className="twitch-button rewards-create-btn"
                onClick={handleCreateReward}
                disabled={creating || !broadcasterId}
              >
                {creating ? t("rewards.creating") : t("rewards.createCta")}
              </button>

              {!creating && rewards.length === 0 && (
                <div className="rewards-empty-state">
                  <a
                    href={HIARTE_HI_TTS_PROJECT_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="hi-tts-project-link"
                    aria-label={t("about.footerApp")}
                  >
                    <img
                      src="/logos/hi-tts-animated.svg"
                      alt=""
                      className="rewards-empty-state-logo"
                    />
                  </a>
                  <p className="card-text rewards-empty-state-text">{t("rewards.empty")}</p>
                </div>
              )}

              {rewards.map((reward) => {
                const img =
                  reward.image?.url_2x ??
                  reward.default_image?.url_2x ??
                  reward.default_image?.url_1x;
                return (
                  <div key={reward.id} className="panel">
                    <div className="rewards-reward-item-header">
                      <div
                        className="rewards-reward-swatch"
                        style={
                          reward.background_color
                            ? { backgroundColor: reward.background_color }
                            : undefined
                        }
                      >
                        {img && <img src={img} alt={reward.title} />}
                      </div>
                      <div className="rewards-reward-info">
                        <div className="rewards-reward-title">{reward.title}</div>
                        <div className="rewards-reward-cost">
                          {reward.cost} {t("rewards.points")}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={
                          rewardsMissingVoice[reward.id]
                            ? "twitch-button twitch-button-voice-error rewards-reward-settings-btn"
                            : "twitch-button rewards-reward-settings-btn"
                        }
                        onClick={() => setSettingsRewardId(reward.id)}
                      >
                        {t("rewards.settings")}
                      </button>
                    </div>

                    {reward.prompt && (
                      <p className="card-text rewards-reward-prompt">{reward.prompt}</p>
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
                  <div className="rewards-empty-state rewards-empty-state-history">
                    <a
                      href={HIARTE_HI_TTS_PROJECT_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="hi-tts-project-link"
                      aria-label={t("about.footerApp")}
                    >
                      <img
                        src="/logos/hi-tts-animated.svg"
                        alt=""
                        className="rewards-empty-state-logo rewards-empty-state-logo-faded"
                      />
                    </a>
                    <p className="card-text rewards-empty-state-text">
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

