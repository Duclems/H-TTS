/**
 * Chaînes des boîtes de dialogue natives (processus principal), alignées sur la locale
 * persistée par le renderer (`hi-tts-locale.json` dans userData).
 */
const fs = require("fs");
const path = require("path");

const LOCALE_FILE_NAME = "hi-tts-locale.json";

/** @param {import("electron").App} app */
function getLocaleFilePath(app) {
  return path.join(app.getPath("userData"), LOCALE_FILE_NAME);
}

/** @param {import("electron").App} app @returns {"fr" | "en"} */
function readStoredLocaleSync(app) {
  try {
    const p = getLocaleFilePath(app);
    if (!fs.existsSync(p)) return "fr";
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw);
    if (j && j.locale === "en") return "en";
    if (j && j.locale === "fr") return "fr";
  } catch {
    // ignore
  }
  return "fr";
}

/** @param {import("electron").App} app @param {"fr" | "en"} locale */
function writeStoredLocaleSync(app, locale) {
  const loc = locale === "en" ? "en" : "fr";
  const p = getLocaleFilePath(app);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ locale: loc }), "utf8");
  } catch {
    // ignore
  }
}

/** @param {import("electron").App} app */
function getDialogStrings(app) {
  const loc = readStoredLocaleSync(app);
  return loc === "en" ? DIALOG_EN : DIALOG_FR;
}

const DIALOG_FR = {
  updateTitle: "Mise à jour Hi-TTS",
  downloadNow: "Télécharger maintenant",
  later: "Plus tard",
  installNow: "Installer maintenant",
  /** @param {string} version */
  updateAvailable: (version) => `Une nouvelle version de Hi-TTS est disponible (${version}).`,
  /** @param {string} version */
  updateDownloaded: (version) =>
    version
      ? `Une nouvelle version de Hi-TTS a été téléchargée (v${version}).`
      : "Une nouvelle version de Hi-TTS a été téléchargée.",
  portInUseTitle: "Hi-TTS",
  /** @param {number} port */
  portInUseMessage: (port) =>
    `Le port ${port} est déjà utilisé et n'a pas pu être libéré automatiquement.\n\n` +
    "Ferme les autres instances de Hi-TTS (et tout serveur de développement), puis relance l'application.",
  serverStartErrorTitle: "Hi-TTS",
  serverStartErrorMessage:
    "Impossible de démarrer le serveur interne (port déjà utilisé). " +
    "Ferme les autres instances et relance l'application."
};

const DIALOG_EN = {
  updateTitle: "Hi-TTS update",
  downloadNow: "Download now",
  later: "Later",
  installNow: "Install now",
  /** @param {string} version */
  updateAvailable: (version) => `A new version of Hi-TTS is available (${version}).`,
  /** @param {string} version */
  updateDownloaded: (version) =>
    version
      ? `A new version of Hi-TTS has been downloaded (v${version}).`
      : "A new version of Hi-TTS has been downloaded.",
  portInUseTitle: "Hi-TTS",
  /** @param {number} port */
  portInUseMessage: (port) =>
    `Port ${port} is already in use and could not be freed automatically.\n\n` +
    "Please close other Hi-TTS instances (and any dev server) and restart the app.",
  serverStartErrorTitle: "Hi-TTS",
  serverStartErrorMessage:
    "Unable to start the internal server (port already in use). " +
    "Please close other instances and restart."
};

module.exports = {
  getLocaleFilePath,
  readStoredLocaleSync,
  writeStoredLocaleSync,
  getDialogStrings
};
