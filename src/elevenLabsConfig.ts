/**
 * Configuration globale ElevenLabs : uniquement la clé API.
 * Les voix et paramètres sont définis par reward (voir rewardVoiceConfig).
 */

export type ElevenLabsConfig = {
  apiKey: string;
};

const ELEVENLABS_STORAGE_KEY = "h_tts_elevenlabs_config";

export function loadElevenLabsConfig(): ElevenLabsConfig {
  try {
    const raw = localStorage.getItem(ELEVENLABS_STORAGE_KEY);
    if (!raw) return { apiKey: "" };
    const parsed = JSON.parse(raw) as Partial<ElevenLabsConfig>;
    return { apiKey: parsed.apiKey ?? "" };
  } catch {
    return { apiKey: "" };
  }
}

export function saveElevenLabsConfig(config: ElevenLabsConfig): void {
  localStorage.setItem(ELEVENLABS_STORAGE_KEY, JSON.stringify(config));
}
