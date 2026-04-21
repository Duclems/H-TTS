/**
 * Clés utilisées par `localStorage` dans toute l'application. On les centralise
 * ici pour :
 *  - éviter les collisions silencieuses (faute de frappe d'un côté seulement),
 *  - avoir une liste exhaustive facile à parcourir lors d'un nettoyage global
 *    (ex : déconnexion, reset, migration de schéma),
 *  - documenter l'usage de chaque clé en un seul endroit.
 *
 * Convention de nommage : prefixe `h_tts_` pour éviter les collisions avec
 * d'autres apps / extensions sur le même origin. Les clés publiées ici sont
 * strictement techniques — aucune info utilisateur brute n'y est stockée.
 */

/** Locale UI sélectionnée (`"fr" | "en"`). */
export const STORAGE_KEY_LOCALE = "h_tts_locale";

/** OAuth state (CSRF) pour le flux Twitch implicit. Éphémère (écrit puis lu une fois). */
export const STORAGE_KEY_TWITCH_OAUTH_STATE = "twitch_oauth_state";

/** Dernier profil Twitch chargé (cache pour affichage immédiat au boot). */
export const STORAGE_KEY_TWITCH_LAST_PROFILE = "h_tts_twitch_last_profile";

/** IDs des redemptions pour lesquelles le TTS audio a déjà été joué. */
export const STORAGE_KEY_REDEEM_AUDIO_COMPLETED = "h_tts_redeem_audio_completed_ids";

/** IDs des redemptions déjà marquées FULFILLED côté Twitch. */
export const STORAGE_KEY_REDEEM_FULFILL_COMPLETED = "h_tts_redeem_fulfill_completed_ids";

/** Petit historique local (capé) des dernières redemptions fulfillées. */
export const STORAGE_KEY_RECENT_FULFILLED_REDEMPTIONS = "h_tts_recent_fulfilled_redemptions";

/** Cache des matches emotes ↔ redemption pour restaurer le rendu au redémarrage. */
export const STORAGE_KEY_EMOTES_BY_REDEMPTION = "h_tts_emotes_by_redemption";

/** Map rewardId → configuration voix ElevenLabs. */
export const STORAGE_KEY_REWARD_VOICE_CONFIGS = "h_tts_reward_voice_configs";

/** Cache label → voiceId pour les voix customisées (éviter un fetch par rendu). */
export const STORAGE_KEY_REWARD_VOICE_LABELS = "h_tts_reward_voice_labels";

/** Dernier payload `user` ElevenLabs connu (affichage offline). */
export const STORAGE_KEY_ELEVEN_LAST_USER = "h_tts_eleven_last_user";

/** Marqueur : la dernière clé API ElevenLabs saisie est connue comme invalide. */
export const STORAGE_KEY_ELEVEN_INVALID_KEY = "h_tts_eleven_invalid_key";

/** Ancienne clé de stockage ElevenLabs (non-chiffrée) — migrée vers secureStorage. */
export const STORAGE_KEY_LEGACY_ELEVEN_CONFIG = "h_tts_elevenlabs_config";

/**
 * Ensemble des clés "data" (purgeables lors d'une déconnexion ou d'un reset).
 * N'inclut PAS la locale (UI) ni l'état OAuth éphémère.
 */
export const ALL_PURGEABLE_STORAGE_KEYS: readonly string[] = [
  STORAGE_KEY_TWITCH_LAST_PROFILE,
  STORAGE_KEY_REDEEM_AUDIO_COMPLETED,
  STORAGE_KEY_REDEEM_FULFILL_COMPLETED,
  STORAGE_KEY_RECENT_FULFILLED_REDEMPTIONS,
  STORAGE_KEY_EMOTES_BY_REDEMPTION,
  STORAGE_KEY_REWARD_VOICE_CONFIGS,
  STORAGE_KEY_REWARD_VOICE_LABELS,
  STORAGE_KEY_ELEVEN_LAST_USER,
  STORAGE_KEY_ELEVEN_INVALID_KEY,
  STORAGE_KEY_LEGACY_ELEVEN_CONFIG
] as const;
