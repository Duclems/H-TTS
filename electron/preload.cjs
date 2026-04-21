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
