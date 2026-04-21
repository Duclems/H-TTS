import { TWITCH_CLIENT_ID } from "./config";

export type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url?: string;
};

type TwitchCustomRewardImage = {
  url_1x: string;
  url_2x: string;
  url_4x: string;
};

export type TwitchCustomReward = {
  id: string;
  title: string;
  cost: number;
  prompt: string | null;
  background_color: string;
  image: TwitchCustomRewardImage | null;
  default_image: TwitchCustomRewardImage;
  is_enabled: boolean;
  is_user_input_required: boolean;
  is_max_per_stream_enabled: boolean;
  max_per_stream: number;
  is_max_per_user_per_stream_enabled: boolean;
  max_per_user_per_stream: number;
  is_global_cooldown_enabled: boolean;
  global_cooldown_seconds: number;
  should_redemptions_skip_request_queue: boolean;
};

export type TwitchRewardRedemption = {
  id: string;
  user_login: string;
  user_display_name: string;
  reward: TwitchCustomReward;
  status: "UNFULFILLED" | "FULFILLED" | "CANCELED";
  redeemed_at: string;
  user_input?: string | null;
};

type HelixResponse<T> = {
  data: T[];
};

type TwitchHelixOk<T> = { ok: true; data: T; status: number };
export type TwitchHelixErr = {
  ok: false;
  status: number;
  retryAfterMs?: number;
  network?: boolean;
};
type TwitchHelixResult<T> = TwitchHelixOk<T> | TwitchHelixErr;

function parseRetryAfterMs(res: Response): number | undefined {
  const raw = res.headers.get("Retry-After");
  if (!raw) return undefined;
  const asSec = Number(raw);
  if (Number.isFinite(asSec) && asSec >= 0) {
    return Math.round(asSec * 1000);
  }
  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return undefined;
}

async function helixGetJson<Element>(
  accessToken: string,
  url: string
): Promise<TwitchHelixResult<Element[]>> {
  try {
    const res = await fetch(url, { headers: buildAuthHeaders(accessToken) });
    const status = res.status;
    if (res.ok) {
      const body = (await res.json()) as HelixResponse<Element>;
      return { ok: true, data: body.data ?? [], status };
    }
    return {
      ok: false,
      status,
      retryAfterMs: parseRetryAfterMs(res)
    };
  } catch {
    return { ok: false, status: 0, network: true };
  }
}

type CreateRewardPayload = {
  title: string;
  cost: number;
  prompt?: string;
  is_enabled?: boolean;
  is_user_input_required?: boolean;
  background_color?: string;
  is_global_cooldown_enabled?: boolean;
  global_cooldown_seconds?: number;
  is_max_per_stream_enabled?: boolean;
  max_per_stream?: number;
  is_max_per_user_per_stream_enabled?: boolean;
  max_per_user_per_stream?: number;
  should_redemptions_skip_request_queue?: boolean;
};

function buildAuthHeaders(accessToken: string): HeadersInit {
  return {
    "Client-Id": TWITCH_CLIENT_ID,
    Authorization: `Bearer ${accessToken}`
  };
}

export async function createEventSubSubscription(
  accessToken: string,
  sessionId: string,
  type: string,
  condition: Record<string, string>,
  version = "1"
): Promise<TwitchHelixResult<unknown>> {
  try {
    const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: {
        ...buildAuthHeaders(accessToken),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type,
        version,
        condition,
        transport: { method: "websocket", session_id: sessionId }
      })
    });
    const status = res.status;
    if (res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: true, data: body, status };
    }
    return { ok: false, status, retryAfterMs: parseRetryAfterMs(res) };
  } catch {
    return { ok: false, status: 0, network: true };
  }
}

export async function fetchCurrentUser(accessToken: string): Promise<TwitchUser | null> {
  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: buildAuthHeaders(accessToken)
  });

  if (!res.ok) return null;

  const body = (await res.json()) as HelixResponse<TwitchUser>;
  return body.data[0] ?? null;
}

export async function fetchUserByLogin(
  accessToken: string,
  login: string
): Promise<TwitchUser | null> {
  const params = new URLSearchParams({ login });
  const res = await fetch(`https://api.twitch.tv/helix/users?${params.toString()}`, {
    headers: buildAuthHeaders(accessToken)
  });
  if (!res.ok) return null;
  const body = (await res.json()) as HelixResponse<TwitchUser>;
  return body.data[0] ?? null;
}

export async function fetchFollowersCount(
  accessToken: string,
  broadcasterId: string
): Promise<number | null> {
  const params = new URLSearchParams({
    broadcaster_id: broadcasterId,
    first: "1"
  });

  const res = await fetch(
    `https://api.twitch.tv/helix/channels/followers?${params.toString()}`,
    {
      headers: buildAuthHeaders(accessToken)
    }
  );

  if (!res.ok) return null;

  const body = (await res.json()) as { total?: number };
  return typeof body.total === "number" ? body.total : null;
}

export async function fetchCustomRewardsResult(
  accessToken: string,
  broadcasterId: string,
  onlyManageable = true
): Promise<TwitchHelixResult<TwitchCustomReward[]>> {
  const params = new URLSearchParams({
    broadcaster_id: broadcasterId,
    only_manageable_rewards: onlyManageable ? "true" : "false"
  });

  return helixGetJson<TwitchCustomReward>(
    accessToken,
    `https://api.twitch.tv/helix/channel_points/custom_rewards?${params.toString()}`
  );
}

export async function fetchRewardRedemptionsResult(
  accessToken: string,
  broadcasterId: string,
  rewardId: string
): Promise<TwitchHelixResult<TwitchRewardRedemption[]>> {
  const params = new URLSearchParams({
    broadcaster_id: broadcasterId,
    reward_id: rewardId,
    status: "UNFULFILLED"
  });

  return helixGetJson<TwitchRewardRedemption>(
    accessToken,
    `https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?${params.toString()}`
  );
}

export async function updateRewardRedemptionStatus(
  accessToken: string,
  broadcasterId: string,
  rewardId: string,
  redemptionIds: string[],
  status: "FULFILLED" | "CANCELED"
): Promise<boolean> {
  if (redemptionIds.length === 0) return true;

  const params = new URLSearchParams({
    broadcaster_id: broadcasterId,
    reward_id: rewardId,
    status
  });
  for (const id of redemptionIds) {
    params.append("id", id);
  }

  const res = await fetch(
    `https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?${params.toString()}`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(accessToken)
    }
  );

  return res.ok;
}

export async function createCustomReward(
  accessToken: string,
  broadcasterId: string,
  payload: CreateRewardPayload
): Promise<TwitchCustomReward | null> {
  const res = await fetch(
    `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(
      broadcasterId
    )}`,
    {
      method: "POST",
      headers: {
        ...buildAuthHeaders(accessToken),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as HelixResponse<TwitchCustomReward>;
  return body.data[0] ?? null;
}

