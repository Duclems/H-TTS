import { loadElevenLabsConfig } from "./elevenLabsConfig";
import type { RewardVoiceConfig } from "./rewardVoiceConfig";

type ElevenSubscription = {
  character_count: number;
  character_limit: number;
};

type ElevenUser = {
  first_name?: string;
  subscription?: ElevenSubscription;
  profile_picture?: string;
  image_url?: string;
};

type ElevenVoice = {
  voice_id: string;
  name: string;
};

function getApiKey(): string | null {
  const { apiKey } = loadElevenLabsConfig();
  return apiKey?.trim() || null;
}

export async function fetchElevenUser(): Promise<ElevenUser | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey
      }
    });

    if (!res.ok) return null;

    const json = (await res.json()) as ElevenUser;
    return json;
  } catch {
    return null;
  }
}

export async function fetchElevenVoices(): Promise<ElevenVoice[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey
      }
    });

    if (!res.ok) return [];

    const json = (await res.json()) as { voices?: ElevenVoice[] };
    return json.voices ?? [];
  } catch {
    return [];
  }
}

/**
 * Teste la permission Text-to-Speech avec un appel minimal (sans lecture audio).
 * Utilise la première voix disponible si voiceId non fourni.
 */
export async function checkElevenTtsPermission(voiceId?: string): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  let vid = voiceId;
  if (!vid) {
    const voices = await fetchElevenVoices();
    if (voices.length === 0) return false;
    vid = voices[0].voice_id;
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text: "a",
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    return blob.size > 0;
  } catch {
    return false;
  }
}

export type ElevenPermissionChecks = {
  user: boolean;
  voices: boolean;
  tts: boolean;
};

/**
 * Vérifie les autorisations ElevenLabs (Utilisateur, Voix).
 * On ne fait pas d'appel TTS de test pour éviter les 402 (Payment Required) en console.
 */
export async function checkElevenPermissions(): Promise<ElevenPermissionChecks> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { user: false, voices: false, tts: false };
  }

  const user = await fetchElevenUser();
  const voices = await fetchElevenVoices();
  const hasVoices = voices.length > 0;

  return {
    user: !!user,
    voices: hasVoices,
    tts: hasVoices
  };
}

/**
 * Lance la synthèse TTS ElevenLabs avec la config voix fournie (par ex. celle du reward).
 * La clé API est toujours lue depuis la config globale (page ElevenLabs).
 */
export async function speakWithElevenLabsFromText(
  text: string,
  voiceConfig: RewardVoiceConfig | null
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const apiKey = getApiKey();
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Clé API manquante, aucun appel effectué.");
    return;
  }

  if (!voiceConfig?.voiceId) {
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Aucune voix configurée pour ce reward, TTS ignoré.");
    return;
  }

  const { voiceId, modelId, stability, similarityBoost, style, speed } = voiceConfig;

  try {
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Envoi du texte à ElevenLabs…", {
      voiceId,
      modelId,
      text: trimmed
    });
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style
        },
        generation_config: {
          speed
        }
      })
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Erreur HTTP", res.status, res.statusText);
      return;
    }

    const blob = await res.blob();
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Audio reçu, taille:", blob.size);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Lecture audio terminée.");
    };
    await audio.play().catch((err) => {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Impossible de lancer la lecture audio", err);
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Erreur réseau ou inattendue", e);
  }
}
