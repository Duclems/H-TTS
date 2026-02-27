export type ElevenLabsConfig = {
  apiKey: string;
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
};

const ELEVENLABS_STORAGE_KEY = "h_tts_elevenlabs_config";

export function loadElevenLabsConfig(): ElevenLabsConfig {
  try {
    const raw = localStorage.getItem(ELEVENLABS_STORAGE_KEY);
    if (!raw) {
      return {
        apiKey: "",
        voiceId: "",
        modelId: "eleven_turbo_v2_5",
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0,
        useSpeakerBoost: false,
        speed: 1
      };
    }
    const parsed = JSON.parse(raw) as Partial<ElevenLabsConfig>;
    return {
      apiKey: parsed.apiKey ?? "",
      voiceId: parsed.voiceId ?? "",
      modelId: parsed.modelId ?? "eleven_turbo_v2_5",
      stability: parsed.stability ?? 0.5,
      similarityBoost: parsed.similarityBoost ?? 0.75,
      style: parsed.style ?? 0,
      useSpeakerBoost: parsed.useSpeakerBoost ?? false,
      speed: parsed.speed ?? 1
    };
  } catch {
    return {
      apiKey: "",
      voiceId: "",
      modelId: "eleven_turbo_v2_5",
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      useSpeakerBoost: false,
      speed: 1
    };
  }
}

export function saveElevenLabsConfig(config: ElevenLabsConfig): void {
  localStorage.setItem(ELEVENLABS_STORAGE_KEY, JSON.stringify(config));
}

