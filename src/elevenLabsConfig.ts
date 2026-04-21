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
