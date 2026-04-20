/**
 * Configuration globale ElevenLabs : clé API via stockage sécurisé (main + safeStorage).
 * Cache mémoire pour les appels API synchrones depuis `elevenLabsApi`.
 */

import {
  migrateLegacySecretsOnce,
  SECURE_KEY_ELEVENLABS,
  secureStorageGet,
  secureStorageSet
} from "./secureStorageBridge";

export type ElevenLabsConfig = {
  apiKey: string;
};

let cachedApiKey = "";

/** Cache en mémoire (rempli par `hydrateElevenLabsFromSecureStorage`). */
export function getCachedElevenLabsApiKey(): string {
  return cachedApiKey;
}

export async function hydrateElevenLabsFromSecureStorage(): Promise<ElevenLabsConfig> {
  await migrateLegacySecretsOnce();
  const raw = await secureStorageGet(SECURE_KEY_ELEVENLABS);
  if (!raw) {
    cachedApiKey = "";
    return { apiKey: "" };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ElevenLabsConfig>;
    cachedApiKey = parsed.apiKey ?? "";
    return { apiKey: cachedApiKey };
  } catch {
    cachedApiKey = "";
    return { apiKey: "" };
  }
}

export async function saveElevenLabsConfig(config: ElevenLabsConfig): Promise<void> {
  cachedApiKey = config.apiKey ?? "";
  const payload = JSON.stringify({ apiKey: cachedApiKey });
  await secureStorageSet(SECURE_KEY_ELEVENLABS, payload);
}

/** Lecture synchrone du cache (après hydratation au démarrage ou après sauvegarde). */
export function loadElevenLabsConfig(): ElevenLabsConfig {
  return { apiKey: cachedApiKey };
}
