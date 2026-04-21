import { createEventSubSubscription } from "./twitchApi";
import { logDebug } from "./debugLog";

const EVENT_SUB_WS_URL = "wss://eventsub.wss.twitch.tv/ws";

/**
 * Event "channel.channel_points_custom_reward_redemption.add|update" renvoyé
 * par EventSub. Format différent du retour Helix (casing minuscule pour le
 * status, `user_name` au lieu de `user_display_name`, reward minimal).
 */
export type EventSubRedeemEvent = {
  id: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  user_id: string;
  user_login: string;
  user_name: string;
  user_input: string;
  status: "unfulfilled" | "fulfilled" | "canceled";
  redeemed_at: string;
  reward: {
    id: string;
    title: string;
    cost: number;
    prompt: string;
  };
};

/**
 * Event "channel.channel_points_custom_reward.add|update|remove" renvoyé par
 * EventSub. Suffit à reconstruire un `TwitchCustomReward` quand on reçoit
 * une création/modification externe.
 */
export type EventSubRewardEvent = {
  id: string;
  broadcaster_user_id: string;
  is_enabled: boolean;
  is_paused: boolean;
  is_in_stock: boolean;
  title: string;
  cost: number;
  prompt: string;
  is_user_input_required: boolean;
  should_redemptions_skip_request_queue: boolean;
  cooldown_expires_at: string | null;
  redemptions_redeemed_current_stream: number | null;
  max_per_stream: { is_enabled: boolean; value: number };
  max_per_user_per_stream: { is_enabled: boolean; value: number };
  global_cooldown: { is_enabled: boolean; seconds: number };
  background_color: string;
  image: { url_1x: string; url_2x: string; url_4x: string } | null;
  default_image: { url_1x: string; url_2x: string; url_4x: string };
};

type SubscriptionType =
  | "channel.channel_points_custom_reward_redemption.add"
  | "channel.channel_points_custom_reward_redemption.update"
  | "channel.channel_points_custom_reward.add"
  | "channel.channel_points_custom_reward.update"
  | "channel.channel_points_custom_reward.remove";

const ALL_SUBSCRIPTION_TYPES: SubscriptionType[] = [
  "channel.channel_points_custom_reward_redemption.add",
  "channel.channel_points_custom_reward_redemption.update",
  "channel.channel_points_custom_reward.add",
  "channel.channel_points_custom_reward.update",
  "channel.channel_points_custom_reward.remove"
];

export type EventSubHandlers = {
  onRedemptionAdd?: (event: EventSubRedeemEvent) => void;
  onRedemptionUpdate?: (event: EventSubRedeemEvent) => void;
  onRewardAdd?: (event: EventSubRewardEvent) => void;
  onRewardUpdate?: (event: EventSubRewardEvent) => void;
  onRewardRemove?: (event: EventSubRewardEvent) => void;
  /** Subscriptions nouvellement créées après perte de connexion : l'app
   * devrait refaire un fetch Helix pour rattraper les events manqués. Pas
   * appelé lors d'un `session_reconnect` (la sub migre sans perte). */
  onReconnect?: () => void;
};

type ConnectOptions = {
  accessToken: string;
  broadcasterId: string;
  handlers: EventSubHandlers;
};

export type EventSubConnection = {
  /** Ferme la WS et annule les reconnects en cours. Idempotent. */
  stop: () => void;
};

type RawMessage = {
  metadata?: {
    message_type?: string;
    subscription_type?: string;
  };
  payload?: {
    session?: { id?: string; reconnect_url?: string };
    subscription?: { type?: string };
    event?: unknown;
  };
};

export function connectEventSub({
  accessToken,
  broadcasterId,
  handlers
}: ConnectOptions): EventSubConnection {
  let activeWs: WebSocket | null = null;
  // Utilisé uniquement pendant une migration `session_reconnect` : on garde
  // l'ancienne WS ouverte jusqu'à réception du welcome sur la nouvelle.
  let pendingWs: WebSocket | null = null;
  let stopped = false;
  let reconnectTimer: number | null = null;
  let reconnectAttempts = 0;
  let isFirstSession = true;

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    reconnectAttempts += 1;
    // Backoff exponentiel capé à 30 s : 1, 2, 4, 8, 16, 30, 30…
    const delayMs = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempts - 1, 5));
    clearReconnectTimer();
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      openConnection(EVENT_SUB_WS_URL, false);
    }, delayMs);
    logDebug({
      timestamp: Date.now(),
      type: "system",
      source: "eventsub",
      message: `WebSocket reconnect scheduled in ${delayMs}ms (attempt ${reconnectAttempts}).`
    });
  };

  const subscribeAll = async (sessionId: string): Promise<boolean> => {
    const results = await Promise.all(
      ALL_SUBSCRIPTION_TYPES.map((type) =>
        createEventSubSubscription(accessToken, sessionId, type, {
          broadcaster_user_id: broadcasterId
        })
      )
    );
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) {
      logDebug({
        timestamp: Date.now(),
        type: "system",
        source: "eventsub",
        message: `${failed}/${ALL_SUBSCRIPTION_TYPES.length} EventSub subscriptions failed.`,
        details: results
          .map((r, i) => (r.ok ? null : { type: ALL_SUBSCRIPTION_TYPES[i], status: r.status }))
          .filter(Boolean)
      });
    }
    return results.some((r) => r.ok);
  };

  const handleMessage = (raw: string, incomingWs: WebSocket) => {
    let msg: RawMessage;
    try {
      msg = JSON.parse(raw) as RawMessage;
    } catch {
      return;
    }
    const messageType = msg.metadata?.message_type;

    if (messageType === "session_welcome") {
      const sessionId = msg.payload?.session?.id;
      if (!sessionId) return;

      // Cas migration Twitch (session_reconnect) : on adopte la nouvelle WS
      // et on ferme l'ancienne. Les subs ont été migrées par Twitch, on ne
      // recrée rien, on ne notifie pas onReconnect.
      if (pendingWs === incomingWs) {
        const old = activeWs;
        activeWs = incomingWs;
        pendingWs = null;
        if (old && old !== incomingWs) {
          try {
            old.close();
          } catch {
            /* ignore */
          }
        }
        return;
      }

      // Première connexion ou reconnect après perte : on recrée les subs.
      activeWs = incomingWs;
      reconnectAttempts = 0;
      const wasFirst = isFirstSession;
      isFirstSession = false;
      void subscribeAll(sessionId).then((anyOk) => {
        if (!anyOk || stopped) return;
        if (!wasFirst) {
          handlers.onReconnect?.();
        }
      });
      return;
    }

    if (messageType === "session_keepalive") {
      // Simple ping Twitch. Rien à faire, la connexion est vivante.
      return;
    }

    if (messageType === "session_reconnect") {
      const reconnectUrl = msg.payload?.session?.reconnect_url;
      if (!reconnectUrl) return;
      // On ouvre la nouvelle WS ; on fermera l'ancienne à la réception du
      // welcome sur la nouvelle.
      openConnection(reconnectUrl, true);
      return;
    }

    if (messageType === "notification") {
      const subType = msg.metadata?.subscription_type as SubscriptionType | undefined;
      const event = msg.payload?.event;
      if (!subType || !event) return;
      switch (subType) {
        case "channel.channel_points_custom_reward_redemption.add":
          handlers.onRedemptionAdd?.(event as EventSubRedeemEvent);
          break;
        case "channel.channel_points_custom_reward_redemption.update":
          handlers.onRedemptionUpdate?.(event as EventSubRedeemEvent);
          break;
        case "channel.channel_points_custom_reward.add":
          handlers.onRewardAdd?.(event as EventSubRewardEvent);
          break;
        case "channel.channel_points_custom_reward.update":
          handlers.onRewardUpdate?.(event as EventSubRewardEvent);
          break;
        case "channel.channel_points_custom_reward.remove":
          handlers.onRewardRemove?.(event as EventSubRewardEvent);
          break;
      }
      return;
    }

    if (messageType === "revocation") {
      logDebug({
        timestamp: Date.now(),
        type: "system",
        source: "eventsub",
        message: `Subscription revoked: ${msg.payload?.subscription?.type ?? "unknown"}.`
      });
    }
  };

  const openConnection = (url: string, migrating: boolean) => {
    if (stopped) return;
    const socket = new WebSocket(url);
    if (migrating) {
      pendingWs = socket;
    }

    socket.onopen = () => {
      logDebug({
        timestamp: Date.now(),
        type: "system",
        source: "eventsub",
        message: `WebSocket opened (${migrating ? "migration" : "initial/reconnect"}).`
      });
    };

    socket.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        handleMessage(ev.data, socket);
      }
    };

    socket.onerror = () => {
      logDebug({
        timestamp: Date.now(),
        type: "system",
        source: "eventsub",
        message: "WebSocket error."
      });
    };

    socket.onclose = () => {
      if (stopped) return;
      if (socket === pendingWs) {
        // La WS de migration est tombée avant son welcome → on abandonne
        // la migration et on garde l'ancienne (encore active).
        pendingWs = null;
        return;
      }
      if (socket === activeWs) {
        activeWs = null;
        scheduleReconnect();
      }
    };
  };

  openConnection(EVENT_SUB_WS_URL, false);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearReconnectTimer();
      if (pendingWs) {
        try {
          pendingWs.close();
        } catch {
          /* ignore */
        }
        pendingWs = null;
      }
      if (activeWs) {
        try {
          activeWs.close();
        } catch {
          /* ignore */
        }
        activeWs = null;
      }
    }
  };
}
