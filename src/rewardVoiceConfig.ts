/**
 * Configuration voix ElevenLabs pour un reward Twitch (stockée par reward.id).
 */

export type RewardVoiceConfig = {
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
};

export const DEFAULT_REWARD_VOICE_CONFIG: RewardVoiceConfig = {
  voiceId: "",
  modelId: "eleven_turbo_v2_5",
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: false,
  speed: 1
};

const STORAGE_KEY = "h_tts_reward_voice_configs";

function loadAll(): Record<string, RewardVoiceConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, RewardVoiceConfig>;
  } catch {
    return {};
  }
}

function saveAll(configs: Record<string, RewardVoiceConfig>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function loadRewardVoiceConfig(rewardId: string): RewardVoiceConfig | null {
  const all = loadAll();
  const cfg = all[rewardId];
  if (!cfg) return null;
  return { ...DEFAULT_REWARD_VOICE_CONFIG, ...cfg };
}

export function saveRewardVoiceConfig(rewardId: string, config: RewardVoiceConfig): void {
  const all = loadAll();
  all[rewardId] = config;
  saveAll(all);
}

export function getDefaultRewardVoiceConfig(): RewardVoiceConfig {
  return { ...DEFAULT_REWARD_VOICE_CONFIG };
}

export type ModelOption = { id: string; label: string; description: string };

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "eleven_v3", label: "Eleven v3 (multilingue, expressif)", description: "Modèle le plus riche émotionnellement, 70+ langues." },
  { id: "eleven_multilingual_v2", label: "Eleven Multilingual v2", description: "Voix naturelle, 29 langues." },
  { id: "eleven_flash_v2_5", label: "Eleven Flash v2.5", description: "Très faible latence, 32 langues." },
  { id: "eleven_turbo_v2_5", label: "Eleven Turbo v2.5", description: "Bon compromis qualité / vitesse, 32 langues." }
];
