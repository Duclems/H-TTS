/**
 * Pont vers le stockage chiffré Electron (preload → IPC → main).
 * Hors Electron (ex. navigateur seul sur le port Vite), repli localStorage de secours pour le dev.
 */

export const SECURE_KEY_TWITCH_TOKEN = "hi_tts_secure_tw_token";
export const SECURE_KEY_ELEVENLABS = "hi_tts_secure_eleven";

const LEGACY_LOCAL_TWITCH = "twitch_oauth_token";
const LEGACY_LOCAL_ELEVEN = "h_tts_elevenlabs_config";

function fallbackStorageKey(secureKey: string): string {
  return `hi_tts_fb_${secureKey}`;
}

function getBridge(): Window["hiTtsSecureStorage"] | undefined {
  if (typeof window === "undefined") return undefined;
  return window.hiTtsSecureStorage;
}

export function hasSecureStorageBridge(): boolean {
  return typeof getBridge()?.get === "function";
}

export async function secureStorageGet(key: string): Promise<string | null> {
  const bridge = getBridge();
  if (bridge) {
    return bridge.get(key);
  }
  try {
    return window.localStorage.getItem(fallbackStorageKey(key));
  } catch {
    return null;
  }
}

export async function secureStorageSet(key: string, value: string | null): Promise<void> {
  const bridge = getBridge();
  if (bridge) {
    await bridge.set(key, value);
    try {
      window.localStorage.removeItem(fallbackStorageKey(key));
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const fb = fallbackStorageKey(key);
    if (value === null || value === "") {
      window.localStorage.removeItem(fb);
    } else {
      window.localStorage.setItem(fb, value);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Migre les anciennes valeurs localStorage vers le stockage sécurisé (une fois par session).
 */
let migrationDone = false;

export async function migrateLegacySecretsOnce(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;

  try {
    const legacyTw = window.localStorage.getItem(LEGACY_LOCAL_TWITCH);
    if (legacyTw) {
      const cur = await secureStorageGet(SECURE_KEY_TWITCH_TOKEN);
      if (!cur) {
        await secureStorageSet(SECURE_KEY_TWITCH_TOKEN, legacyTw);
      }
      window.localStorage.removeItem(LEGACY_LOCAL_TWITCH);
    }
  } catch {
    /* ignore */
  }

  try {
    const legacyEl = window.localStorage.getItem(LEGACY_LOCAL_ELEVEN);
    if (legacyEl) {
      const cur = await secureStorageGet(SECURE_KEY_ELEVENLABS);
      if (!cur) {
        await secureStorageSet(SECURE_KEY_ELEVENLABS, legacyEl);
      }
      window.localStorage.removeItem(LEGACY_LOCAL_ELEVEN);
    }
  } catch {
    /* ignore */
  }
}
