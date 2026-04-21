import tmi from "tmi.js";
import { logDebug } from "./debugLog";

const IS_DEV = import.meta.env.DEV;

// On tape en any pour rester compatible avec le runtime tmi.js côté navigateur/Electron
// sans dépendre des typings externes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any | null = null;
let started = false;

type StartOptions = {
  channelLogin: string;
};

export type ParsedEmotePosition = {
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
  if (started) return;
  started = true;

  const username = channelLogin.toLowerCase();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  client = new (tmi as any).Client({
    options: { debug: false },
    connection: {
      secure: true,
      reconnect: true
    },
    channels: [username]
  });

  client.on("message", (channel: string, tags: any, message: string, self: boolean) => {
    if (self) return;
    const parsedEmotes = parseEmotesFromTmi(message, tags?.emotes);
    const payload: ChatMessageWithEmotes = {
      channel,
      userDisplayName: tags["display-name"],
      userLogin: tags.username,
      message,
      rewardId: typeof tags["custom-reward-id"] === "string" ? tags["custom-reward-id"] : undefined,
      parsedEmotes,
      timestamp: Date.now()
    };

    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[Hi-TTS][IRC]", payload);
    }

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

    for (const listener of listeners) {
      listener(payload);
    }
  });

  client
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

