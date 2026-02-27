import { TWITCH_CLIENT_ID, TWITCH_REDIRECT_URI, TWITCH_SCOPES } from "./config";

const TWITCH_AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";

export type TwitchTokenResponse = {
  access_token: string;
  scope: string[];
  token_type: string;
  state?: string;
};

const STATE_KEY = "twitch_oauth_state";
const TOKEN_KEY = "twitch_oauth_token";

function generateRandomState(length = 32): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < length; i += 1) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export function buildTwitchAuthorizeUrl(): string {
  const state = generateRandomState();
  localStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: TWITCH_REDIRECT_URI,
    response_type: "token",
    scope: TWITCH_SCOPES,
    state,
    force_verify: "true"
  });

  return `${TWITCH_AUTHORIZE_URL}?${params.toString()}`;
}

export function parseHashFragment(hash: string): TwitchTokenResponse | null {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);

  const accessToken = params.get("access_token");
  const tokenType = params.get("token_type");
  const scopeRaw = params.get("scope");
  const state = params.get("state") ?? undefined;

  if (!accessToken || !tokenType) {
    return null;
  }

  const scope = scopeRaw ? scopeRaw.split(" ") : [];

  return {
    access_token: accessToken,
    token_type: tokenType,
    scope,
    state
  };
}

export function validateState(returnedState?: string | null): boolean {
  const stored = localStorage.getItem(STATE_KEY);
  if (!stored || !returnedState) return false;
  const ok = stored === returnedState;
  if (ok) {
    localStorage.removeItem(STATE_KEY);
  }
  return ok;
}

export function storeToken(token: TwitchTokenResponse): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export function getStoredToken(): TwitchTokenResponse | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TwitchTokenResponse;
  } catch {
    return null;
  }
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

