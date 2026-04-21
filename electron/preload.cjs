const { contextBridge, ipcRenderer } = require("electron");

/** Doit rester aligné avec `ALLOWED_KEYS` dans `main.cjs`. */
const ALLOWED_KEYS = ["hi_tts_secure_tw_token", "hi_tts_secure_eleven"];

/**
 * Stockage secrets via le main (safeStorage + fichier userData).
 * Jamais de require("electron") dans le renderer.
 */
contextBridge.exposeInMainWorld("hiTtsApp", {
  /**
   * Persiste la locale pour les boîtes de dialogue natives (processus principal).
   * @param {"fr" | "en"} locale
   * @returns {Promise<void>}
   */
  setLocale: (locale) => ipcRenderer.invoke("app-locale:set", locale)
});

contextBridge.exposeInMainWorld("hiTtsTwitchOAuth", {
  /**
   * @param {{ clientId: string, scopes: string }} args
   * @returns {Promise<{ ok: boolean, data?: { sessionId: string, userCode: string, verificationUri: string, expiresIn: number, interval: number }, error?: string }>}
   */
  start: (args) => ipcRenderer.invoke("twitch-oauth:start", args),
  /**
   * Attend que l'utilisateur valide l'autorisation côté Twitch.
   * @param {string} sessionId
   */
  waitForToken: (sessionId) => ipcRenderer.invoke("twitch-oauth:wait", sessionId),
  /** @param {string} sessionId */
  cancel: (sessionId) => ipcRenderer.invoke("twitch-oauth:cancel", sessionId),
  /** @param {{ clientId: string, refreshToken: string }} args */
  refresh: (args) => ipcRenderer.invoke("twitch-oauth:refresh", args),
  /** @param {string} url */
  openVerification: (url) => ipcRenderer.invoke("twitch-oauth:open-verification", url)
});

contextBridge.exposeInMainWorld("hiTtsSecureStorage", {
  /**
   * @param {string} key
   * @returns {Promise<string | null>}
   */
  get: (key) => {
    if (typeof key !== "string" || !ALLOWED_KEYS.includes(key)) {
      return Promise.resolve(null);
    }
    return ipcRenderer.invoke("secure-storage:get", key);
  },
  /**
   * @param {string} key
   * @param {string | null} value JSON brut ou null pour supprimer
   * @returns {Promise<void>}
   */
  set: (key, value) => {
    if (typeof key !== "string" || !ALLOWED_KEYS.includes(key)) {
      return Promise.resolve();
    }
    if (value !== null && typeof value !== "string") {
      return Promise.resolve();
    }
    return ipcRenderer.invoke("secure-storage:set", key, value);
  },
  /** @returns {Promise<boolean>} */
  isEncryptionAvailable: () => ipcRenderer.invoke("secure-storage:isEncryptionAvailable")
});
