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

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Erreur HTTP sur /v1/user", res.status, res.statusText);
      return null;
    }

    const json = (await res.json()) as ElevenUser;
    return json;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Erreur réseau sur /v1/user", e);
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

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Erreur HTTP sur /v2/voices", res.status, res.statusText);
      return [];
    }

    const json = (await res.json()) as { voices?: ElevenVoice[] };
    return json.voices ?? [];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Erreur réseau sur /v2/voices", e);
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
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Erreur HTTP TTS (permission)", res.status, res.statusText);
      return false;
    }
    const blob = await res.blob();
    return blob.size > 0;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Erreur réseau TTS (permission)", e);
    return false;
  }
}

export type ElevenPermissionChecks = {
  user: boolean;
  voices: boolean;
  tts: boolean;
};

/**
 * Teste les trois autorisations ElevenLabs (Utilisateur, Voix, Text to Speech).
 * On ne marque TTS comme invalide que si on a pu le tester (au moins une voix) et qu'il a échoué.
 * Sans voix on ne peut pas tester le TTS, donc on ne le considère pas comme cassé.
 */
export async function checkElevenPermissions(): Promise<ElevenPermissionChecks> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { user: false, voices: false, tts: false };
  }

  const user = await fetchElevenUser();
  const voices = await fetchElevenVoices();
  const tts =
    voices.length > 0 ? await checkElevenTtsPermission(voices[0].voice_id) : true;

  return {
    user: !!user,
    voices: voices.length > 0,
    tts
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
