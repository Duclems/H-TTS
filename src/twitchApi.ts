import { TWITCH_CLIENT_ID } from "./config";

export type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
};

export type TwitchCustomRewardImage = {
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

export async function fetchCurrentUser(accessToken: string): Promise<TwitchUser | null> {
  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: buildAuthHeaders(accessToken)
  });

  if (!res.ok) return null;

  const body = (await res.json()) as HelixResponse<TwitchUser>;
  return body.data[0] ?? null;
}

export async function fetchCustomRewards(
  accessToken: string,
  broadcasterId: string
): Promise<TwitchCustomReward[]> {
  const params = new URLSearchParams({
    broadcaster_id: broadcasterId,
    only_manageable_rewards: "false"
  });

  const res = await fetch(
    `https://api.twitch.tv/helix/channel_points/custom_rewards?${params.toString()}`,
    {
      headers: buildAuthHeaders(accessToken)
    }
  );

  if (!res.ok) return [];

  const body = (await res.json()) as HelixResponse<TwitchCustomReward>;
  return body.data;
}

export async function fetchRewardRedemptions(
  accessToken: string,
  broadcasterId: string,
  rewardId: string
): Promise<TwitchRewardRedemption[]> {
  const params = new URLSearchParams({
    broadcaster_id: broadcasterId,
    reward_id: rewardId,
    status: "UNFULFILLED" // par défaut : les réclamations en attente
  });

  const res = await fetch(
    `https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?${params.toString()}`,
    {
      headers: buildAuthHeaders(accessToken)
    }
  );

  if (!res.ok) return [];

  const body = (await res.json()) as HelixResponse<TwitchRewardRedemption>;
  return body.data;
}

const LAST_REWARD_ID_KEY = "h_tts_last_custom_reward_id";

export function getLastCreatedRewardId(): string | null {
  return localStorage.getItem(LAST_REWARD_ID_KEY);
}

export function storeLastCreatedRewardId(id: string): void {
  localStorage.setItem(LAST_REWARD_ID_KEY, id);
}

export function clearLastCreatedRewardId(): void {
  localStorage.removeItem(LAST_REWARD_ID_KEY);
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
  const reward = body.data[0] ?? null;
  if (reward) {
    storeLastCreatedRewardId(reward.id);
  }
  return reward;
}

