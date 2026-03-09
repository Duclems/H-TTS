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
    const res = await fetch(
      // On récupère les voix de la bibliothèque de l’utilisateur ("Mes Voix").
      // voice_type=saved = toutes les voix non-default + les voix par défaut
      // ajoutées à une collection (ce qui correspond à ce que l’utilisateur
      // a explicitement ajouté dans sa bibliothèque).
      "https://api.elevenlabs.io/v2/voices?page_size=100&voice_type=saved",
      {
      method: "GET",
      headers: {
        "xi-api-key": apiKey
        }
      }
    );

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
const IS_DEV = import.meta.env.DEV;

export type ElevenTtsResult = {
  ok: boolean;
  status?: number;
};

export async function speakWithElevenLabsFromText(
  text: string,
  voiceConfig: RewardVoiceConfig | null
): Promise<ElevenTtsResult> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const apiKey = getApiKey();
  if (!apiKey) {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Clé API manquante, aucun appel effectué.");
    }
    return { ok: false };
  }

  if (!voiceConfig?.voiceId) {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Aucune voix configurée pour ce reward, TTS ignoré.");
    }
    return { ok: false };
  }

  const { voiceId, modelId, stability, similarityBoost, style, speed } = voiceConfig;

  try {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Envoi du texte à ElevenLabs…", {
        voiceId,
        modelId,
        text: trimmed
      });
    }
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
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.log("[ElevenLabs] Erreur HTTP", res.status, res.statusText);
      }
      return { ok: false, status: res.status };
    }

    const blob = await res.blob();
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Audio reçu, taille:", blob.size);
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.log("[ElevenLabs] Lecture audio terminée.");
      }
    };
    await audio.play().catch((err) => {
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.log("[ElevenLabs] Impossible de lancer la lecture audio", err);
      }
    });
    return { ok: true, status: res.status };
  } catch (e) {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Erreur réseau ou inattendue", e);
    }
    return { ok: false };
  }
}
