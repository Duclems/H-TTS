export const HIARTE_HI_TTS_PROJECT_URL = "https://www.hiarte.fr/projects/hi-tts/";

export const TWITCH_CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID as string;
export const TWITCH_REDIRECT_URI =
  (import.meta.env.VITE_TWITCH_REDIRECT_URI as string) ?? "http://localhost:55510/auth/callback";
export const TWITCH_SCOPES =
  (import.meta.env.VITE_TWITCH_SCOPES as string) ?? "user:read:email";

if (!TWITCH_CLIENT_ID) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Twitch OAuth] VITE_TWITCH_CLIENT_ID n'est pas défini. Pense à créer ton fichier .env à partir de .env.example."
  );
}

