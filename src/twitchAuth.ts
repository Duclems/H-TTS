import { TWITCH_CLIENT_ID, TWITCH_REDIRECT_URI, TWITCH_SCOPES } from "./config";
import {
  migrateLegacySecretsOnce,
  SECURE_KEY_TWITCH_TOKEN,
  secureStorageGet,
  secureStorageSet
} from "./secureStorageBridge";
import { STORAGE_KEY_TWITCH_OAUTH_STATE as STATE_KEY } from "./storageKeys";

const TWITCH_AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";

export type TwitchTokenResponse = {
  access_token: string;
  scope: string[];
  token_type: string;
  state?: string;
};

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

/**
 * L’utilisateur a refusé / annulé l’autorisation sur la page Twitch (flux implicit).
 * Twitch renvoie typiquement `#error=access_denied&state=...`.
 */
export function isOAuthImplicitAccessDenied(hash: string): boolean {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed) return false;
  const params = new URLSearchParams(trimmed);
  return params.get("error") === "access_denied";
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

export async function storeToken(token: TwitchTokenResponse): Promise<void> {
  await migrateLegacySecretsOnce();
  await secureStorageSet(SECURE_KEY_TWITCH_TOKEN, JSON.stringify(token));
}

export async function getStoredToken(): Promise<TwitchTokenResponse | null> {
  await migrateLegacySecretsOnce();
  const raw = await secureStorageGet(SECURE_KEY_TWITCH_TOKEN);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TwitchTokenResponse;
  } catch {
    return null;
  }
}

export async function clearStoredToken(): Promise<void> {
  await secureStorageSet(SECURE_KEY_TWITCH_TOKEN, null);
}
