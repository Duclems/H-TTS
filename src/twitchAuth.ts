import { TWITCH_CLIENT_ID, TWITCH_SCOPES } from "./config";
import {
  migrateLegacySecretsOnce,
  SECURE_KEY_TWITCH_TOKEN,
  secureStorageGet,
  secureStorageSet
} from "./secureStorageBridge";

export type TwitchTokenResponse = {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  scope: string[];
  expires_in: number;
  expires_at: number;
};

export type DeviceFlowStart = {
  sessionId: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

declare global {
  interface Window {
    hiTtsTwitchOAuth?: {
      start: (args: {
        clientId: string;
        scopes: string;
      }) => Promise<IpcResult<DeviceFlowStart>>;
      waitForToken: (sessionId: string) => Promise<IpcResult<TwitchTokenResponse>>;
      cancel: (sessionId: string) => Promise<boolean>;
      refresh: (args: {
        clientId: string;
        refreshToken: string;
      }) => Promise<IpcResult<TwitchTokenResponse>>;
      openVerification: (url: string) => Promise<boolean>;
    };
  }
}

function getBridge(): NonNullable<Window["hiTtsTwitchOAuth"]> {
  const bridge = typeof window !== "undefined" ? window.hiTtsTwitchOAuth : undefined;
  if (!bridge) {
    throw new Error(
      "Le pont d'authentification Twitch n'est pas disponible. Cette version doit être lancée depuis l'application Electron Hi-TTS."
    );
  }
  return bridge;
}

export async function startDeviceFlow(): Promise<DeviceFlowStart> {
  if (!TWITCH_CLIENT_ID) {
    throw new Error("missing_client_id");
  }
  const res = await getBridge().start({
    clientId: TWITCH_CLIENT_ID,
    scopes: TWITCH_SCOPES
  });
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function waitForDeviceToken(sessionId: string): Promise<TwitchTokenResponse> {
  const res = await getBridge().waitForToken(sessionId);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function cancelDeviceFlow(sessionId: string): Promise<void> {
  try {
    await getBridge().cancel(sessionId);
  } catch {
    /* ignore */
  }
}

export async function openTwitchVerification(url: string): Promise<boolean> {
  try {
    return await getBridge().openVerification(url);
  } catch {
    return false;
  }
}

export async function refreshTwitchToken(
  refreshToken: string
): Promise<TwitchTokenResponse> {
  if (!TWITCH_CLIENT_ID) throw new Error("missing_client_id");
  const res = await getBridge().refresh({
    clientId: TWITCH_CLIENT_ID,
    refreshToken
  });
  if (!res.ok) {
    const err = new Error(res.error) as Error & { status?: number };
    if (res.status) err.status = res.status;
    throw err;
  }
  return res.data;
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
    const parsed = JSON.parse(raw) as Partial<TwitchTokenResponse> & {
      access_token?: unknown;
    };
    if (typeof parsed.access_token !== "string" || !parsed.access_token) return null;
    return {
      access_token: parsed.access_token,
      refresh_token:
        typeof parsed.refresh_token === "string" ? parsed.refresh_token : null,
      token_type: typeof parsed.token_type === "string" ? parsed.token_type : "bearer",
      scope: Array.isArray(parsed.scope)
        ? parsed.scope.filter((s): s is string => typeof s === "string")
        : [],
      expires_in: typeof parsed.expires_in === "number" ? parsed.expires_in : 0,
      expires_at: typeof parsed.expires_at === "number" ? parsed.expires_at : 0
    };
  } catch {
    return null;
  }
}

export async function clearStoredToken(): Promise<void> {
  await secureStorageSet(SECURE_KEY_TWITCH_TOKEN, null);
}

/**
 * Renvoie un token valide. Si le token courant est sur le point d'expirer
 * (moins de `skewSeconds` avant expiration) et qu'un refresh token existe,
 * tente un refresh silencieux et persiste le résultat.
 *
 * - Renvoie `null` si aucun token stocké.
 * - Renvoie `null` et efface le stockage si le refresh est rejeté (revoqué, etc.).
 */
export async function getValidToken(
  skewSeconds = 120
): Promise<TwitchTokenResponse | null> {
  const current = await getStoredToken();
  if (!current) return null;

  const needsRefresh =
    current.expires_at > 0 && current.expires_at - Date.now() < skewSeconds * 1000;

  if (!needsRefresh) return current;
  if (!current.refresh_token) return current;

  try {
    const refreshed = await refreshTwitchToken(current.refresh_token);
    await storeToken(refreshed);
    return refreshed;
  } catch {
    await clearStoredToken();
    return null;
  }
}
