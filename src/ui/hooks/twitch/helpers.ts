import type {
  TwitchCustomReward,
  TwitchHelixErr,
  TwitchRewardRedemption
} from "../../../twitchApi";
import type {
  EventSubRedeemEvent,
  EventSubRewardEvent
} from "../../../twitchEventSub";
import type { ChatMessageWithEmotes, ParsedEmote } from "../../../twitchChat";
import { STORAGE_KEY_RECENT_FULFILLED_REDEMPTIONS as RECENT_FULFILLED_KEY } from "../../../storageKeys";

export type EmoteMatch = { emotes: ParsedEmote[]; chatText?: string };

export const POLL_BACKOFF_MAX_MS = 120_000;
export const RECENT_FULFILLED_MAX = 5;
export const VISIBLE_REDEMPTIONS_MAX = 5;
export const COMPLETION_SET_MAX = 500;
export const CHAT_BUFFER_MAX = 200;

const REDEEM_FP_SEP = "\u001f";
const REDEEM_ROW_SEP = "\u001e";

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function pollBackoffDelayMs(err: TwitchHelixErr, consecutiveFailures: number): number {
  if (err.retryAfterMs != null && err.retryAfterMs > 0) {
    return Math.min(POLL_BACKOFF_MAX_MS, err.retryAfterMs);
  }
  if (err.network) {
    return Math.min(
      POLL_BACKOFF_MAX_MS,
      2_000 * 2 ** Math.min(Math.max(0, consecutiveFailures - 1), 6)
    );
  }
  if (err.status === 429) return Math.min(POLL_BACKOFF_MAX_MS, 10_000);
  if (err.status >= 500) return Math.min(POLL_BACKOFF_MAX_MS, 5_000);
  return Math.min(POLL_BACKOFF_MAX_MS, 15_000);
}

export function rewardsActiveForPoll(all: TwitchCustomReward[]): TwitchCustomReward[] {
  return all.filter((r) => r.is_enabled);
}

export function getRedemptionsFingerprint(list: TwitchRewardRedemption[]): string {
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

export function readStringIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

export function persistStringIdSet(key: string, set: Set<string>) {
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

export function readRecentFulfilledRedemptions(): TwitchRewardRedemption[] {
  try {
    const raw = localStorage.getItem(RECENT_FULFILLED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TwitchRewardRedemption[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendRecentFulfilledRedemption(
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

export function mapEventSubRedemption(
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

export function mapEventSubReward(event: EventSubRewardEvent): TwitchCustomReward {
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
