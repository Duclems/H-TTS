import { getCachedElevenLabsApiKey } from "./elevenLabsConfig";
import { logDebug } from "./debugLog";
import type { RewardVoiceConfig } from "./rewardVoiceConfig";

type ElevenSubscription = {
  character_count: number;
  character_limit: number;
};

export type ElevenUser = {
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
  const trimmed = getCachedElevenLabsApiKey().trim();
  return trimmed || null;
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
 * Lance la synthèse TTS ElevenLabs avec la config voix fournie (par ex. celle du reward).
 * La clé API est toujours lue depuis la config globale (page ElevenLabs).
 */
const IS_DEV = import.meta.env.DEV;

export type ElevenTtsResult = {
  /** Requête ElevenLabs HTTP réussie (audio reçu). */
  httpOk: boolean;
  /** Lecture audio allée au bout (`ended`). */
  playedToEnd: boolean;
  status?: number;
};

function waitForAudioPlaybackEnd(audio: HTMLAudioElement, objectUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };

    const onEnded = () => {
      cleanup();
      URL.revokeObjectURL(objectUrl);
      resolve();
    };

    const onError = () => {
      cleanup();
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Audio playback error"));
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
  });
}

export async function speakWithElevenLabsFromText(
  text: string,
  voiceConfig: RewardVoiceConfig | null
): Promise<ElevenTtsResult> {
  const trimmed = text.trim();
  if (!trimmed) return { httpOk: false, playedToEnd: false };

  const apiKey = getApiKey();
  if (!apiKey) {
    logDebug({
      timestamp: Date.now(),
      type: "eleven",
      source: "eleven-tts",
      message: "TTS request skipped: missing ElevenLabs API key.",
    });
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Clé API manquante, aucun appel effectué.");
    }
    return { httpOk: false, playedToEnd: false };
  }

  if (!voiceConfig?.voiceId) {
    logDebug({
      timestamp: Date.now(),
      type: "eleven",
      source: "eleven-tts",
      message: "TTS request skipped: no voice configured for this reward.",
    });
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Aucune voix configurée pour ce reward, TTS ignoré.");
    }
    return { httpOk: false, playedToEnd: false };
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
      logDebug({
        timestamp: Date.now(),
        type: "eleven",
        source: "eleven-tts",
        message: "ElevenLabs HTTP error during TTS request.",
        details: { status: res.status, statusText: res.statusText },
      });
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.log("[ElevenLabs] Erreur HTTP", res.status, res.statusText);
      }
      return { httpOk: false, playedToEnd: false, status: res.status };
    }

    const blob = await res.blob();
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Audio reçu, taille:", blob.size);
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const playback = waitForAudioPlaybackEnd(audio, url);
    try {
      await audio.play();
    } catch (err) {
      logDebug({
        timestamp: Date.now(),
        type: "eleven",
        source: "eleven-tts",
        message: "Failed to start ElevenLabs audio playback.",
        details: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      });
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.log("[ElevenLabs] Impossible de lancer la lecture audio", err);
      }
      URL.revokeObjectURL(url);
      return { httpOk: true, playedToEnd: false, status: res.status };
    }

    try {
      await playback;
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.log("[ElevenLabs] Lecture audio terminée.");
      }
      return { httpOk: true, playedToEnd: true, status: res.status };
    } catch {
      return { httpOk: true, playedToEnd: false, status: res.status };
    }
  } catch (e) {
    logDebug({
      timestamp: Date.now(),
      type: "eleven",
      source: "eleven-tts",
      message: "Network or unexpected error during ElevenLabs request.",
      details: e instanceof Error ? { name: e.name, message: e.message } : String(e),
    });
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Erreur réseau ou inattendue", e);
    }
    return { httpOk: false, playedToEnd: false };
  }
}
