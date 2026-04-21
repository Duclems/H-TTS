import tmi, { type TmiClient } from "tmi.js";
import { logDebug } from "./debugLog";

const IS_DEV = import.meta.env.DEV;

let client: TmiClient | null = null;
let started = false;
let startedChannel: string | null = null;

type StartOptions = {
  channelLogin: string;
};

type ParsedEmotePosition = {
  start: number;
  end: number;
};

export type ParsedEmote = {
  id: string;
  code: string;
  positions: ParsedEmotePosition[];
  urls: {
    "1x": string;
    "2x": string;
    "3x": string;
  };
};

export type ChatMessageWithEmotes = {
  channel: string;
  userDisplayName: string | undefined;
  userLogin: string | undefined;
  message: string;
  rewardId?: string;
  parsedEmotes: ParsedEmote[];
  timestamp: number;
};

const listeners: ((msg: ChatMessageWithEmotes) => void)[] = [];

export function addTwitchChatListener(listener: (msg: ChatMessageWithEmotes) => void): void {
  listeners.push(listener);
}

export function removeTwitchChatListener(listener: (msg: ChatMessageWithEmotes) => void): void {
  const idx = listeners.indexOf(listener);
  if (idx >= 0) {
    listeners.splice(idx, 1);
  }
}

function parseEmotesFromTmi(message: string, emotesTag: unknown): ParsedEmote[] {
  if (!emotesTag || typeof emotesTag !== "object") return [];

  const entries = Object.entries(emotesTag as Record<string, unknown>);
  const result: ParsedEmote[] = [];

  for (const [emoteId, rawPositions] of entries) {
    if (!Array.isArray(rawPositions)) continue;

    const positions: ParsedEmotePosition[] = [];

    for (const raw of rawPositions) {
      if (typeof raw !== "string") continue;
      const [startStr, endStr] = raw.split("-");
      const start = Number.parseInt(startStr, 10);
      const end = Number.parseInt(endStr, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      positions.push({ start, end });
    }

    if (positions.length === 0) continue;

    const first = positions[0];
    const code = message.slice(first.start, first.end + 1);

    result.push({
      id: emoteId,
      code,
      positions,
      urls: {
        "1x": `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0`,
        "2x": `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/2.0`,
        "3x": `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/3.0`
      }
    });
  }

  return result;
}

export function startTwitchChatLogger({ channelLogin }: StartOptions): void {
  const username = channelLogin.toLowerCase();

  if (started && startedChannel === username) return;
  if (started) stopTwitchChatLogger();

  started = true;
  startedChannel = username;

  const newClient: TmiClient = new tmi.Client({
    options: { debug: false },
    connection: {
      secure: true,
      reconnect: true
    },
    channels: [username]
  });
  client = newClient;

  newClient.on("message", (channel, tags, message, self) => {
    if (self) return;
    const displayName = tags["display-name"];
    const userLogin = tags.username;
    const rewardId = tags["custom-reward-id"];
    const parsedEmotes = parseEmotesFromTmi(message, tags.emotes);
    const payload: ChatMessageWithEmotes = {
      channel,
      userDisplayName: typeof displayName === "string" ? displayName : undefined,
      userLogin: typeof userLogin === "string" ? userLogin : undefined,
      message,
      rewardId: typeof rewardId === "string" ? rewardId : undefined,
      parsedEmotes,
      timestamp: Date.now()
    };

    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[Hi-TTS][IRC]", payload);
    }

    if (IS_DEV || payload.rewardId) {
      logDebug({
        timestamp: Date.now(),
        type: payload.rewardId ? "redeem" : "other",
        source: "chat-message",
        message: payload.rewardId
          ? `Chat message linked to a reward redemption received on #${username}.`
          : `Chat message received on #${username}.`,
        details: {
          channel,
          user: payload.userDisplayName || payload.userLogin,
          hasRewardId: !!payload.rewardId,
        },
      });
    }

    for (const listener of listeners) {
      listener(payload);
    }
  });

  newClient
    .connect()
    .then(() => {
      logDebug({
        timestamp: Date.now(),
        type: "system",
        source: "chat-connect",
        message: `Connected to Twitch chat for #${username}.`,
      });
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.log(`[Hi-TTS][IRC] Connecté au chat Twitch pour #${username}`);
      }
    })
    .catch((err: unknown) => {
      logDebug({
        timestamp: Date.now(),
        type: "system",
        source: "chat-connect",
        message: `Failed to connect to Twitch chat for #${username}.`,
        details: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      });
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.warn("[Hi-TTS][IRC] Échec de connexion au chat Twitch", err);
      }
    });
}

export function stopTwitchChatLogger(): void {
  if (!started) return;
  const previousClient = client;
  const previousChannel = startedChannel;
  client = null;
  started = false;
  startedChannel = null;

  if (previousClient) {
    try {
      previousClient.disconnect().catch(() => undefined);
    } catch {
      /* ignore */
    }

    logDebug({
      timestamp: Date.now(),
      type: "system",
      source: "chat-disconnect",
      message: previousChannel
        ? `Disconnected from Twitch chat for #${previousChannel}.`
        : "Disconnected from Twitch chat.",
    });
  }
}

