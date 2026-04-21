export type RewardVoiceConfig = {
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
};

const DEFAULT_REWARD_VOICE_CONFIG: RewardVoiceConfig = {
  voiceId: "",
  modelId: "eleven_turbo_v2_5",
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  speed: 1
};

import { STORAGE_KEY_REWARD_VOICE_CONFIGS as STORAGE_KEY } from "./storageKeys";

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

export function loadAllRewardVoiceConfigs(): Record<string, RewardVoiceConfig> {
  const all = loadAll();
  const result: Record<string, RewardVoiceConfig> = {};
  for (const id of Object.keys(all)) {
    result[id] = { ...DEFAULT_REWARD_VOICE_CONFIG, ...all[id] };
  }
  return result;
}

export function saveRewardVoiceConfig(rewardId: string, config: RewardVoiceConfig): void {
  const all = loadAll();
  all[rewardId] = config;
  saveAll(all);
}

export function getDefaultRewardVoiceConfig(): RewardVoiceConfig {
  return { ...DEFAULT_REWARD_VOICE_CONFIG };
}

type ModelOption = { id: string; label: string };

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "eleven_v3", label: "Eleven v3 (multilingue, expressif)" },
  { id: "eleven_multilingual_v2", label: "Eleven Multilingual v2" },
  { id: "eleven_flash_v2_5", label: "Eleven Flash v2.5" },
  { id: "eleven_turbo_v2_5", label: "Eleven Turbo v2.5" }
];
