import { loadElevenLabsConfig } from "./elevenLabsConfig";

export async function speakWithElevenLabsFromText(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const { apiKey, voiceId, modelId, stability, similarityBoost, style, useSpeakerBoost, speed } =
    loadElevenLabsConfig();
  if (!apiKey || !voiceId) {
    // Pas de configuration ElevenLabs, on ne fait rien.
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Config manquante, aucun appel effectué.");
    return;
  }

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
          style,
          use_speaker_boost: useSpeakerBoost
        },
        generation_config: {
          // le backend acceptera cette valeur ou l'ignorera suivant le modèle
          speed
        }
      })
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Erreur HTTP", res.status, res.statusText);
      // En cas d'erreur API, on ne bloque pas l'app.
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
    // On tente de lire le son ; si l'utilisateur doit interagir d'abord, le navigateur bloquera simplement.
    await audio.play().catch((err) => {
      // eslint-disable-next-line no-console
      console.log("[ElevenLabs] Impossible de lancer la lecture audio", err);
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[ElevenLabs] Erreur réseau ou inattendue", e);
    // On ignore les erreurs réseau ici pour garder l'app fluide.
  }
}

