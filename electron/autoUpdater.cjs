const { app, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { getDialogStrings } = require("./mainLocale.cjs");

const isDev = !app.isPackaged;
const AUTO_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let pendingUpdateVersion = "";
let autoUpdaterIntervalId = null;

function setupAutoUpdater({ getWindow }) {
  if (isDev) return;

  autoUpdater.autoDownload = false;

  autoUpdater.on("error", (error) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.setProgressBar(-1);
    }
    // eslint-disable-next-line no-console
    console.error("[Hi-TTS] Erreur auto-update", error);
  });

  autoUpdater.on("update-available", (info) => {
    pendingUpdateVersion = typeof info?.version === "string" ? info.version.trim() : "";
    // eslint-disable-next-line no-console
    console.log("[Hi-TTS] Mise à jour disponible", info.version);

    const L = getDialogStrings(app);
    const result = dialog.showMessageBoxSync({
      type: "info",
      buttons: [L.downloadNow, L.later],
      defaultId: 0,
      cancelId: 1,
      title: L.updateTitle,
      message: L.updateAvailable(String(info.version ?? ""))
    });

    if (result === 0) {
      autoUpdater.downloadUpdate().catch((error) => {
        // eslint-disable-next-line no-console
        console.error("[Hi-TTS] Erreur lors du téléchargement de la mise à jour", error);
      });
    }
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const percent = Math.max(0, Math.min(100, Number(progressObj?.percent ?? 0)));
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.setProgressBar(percent / 100);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[Hi-TTS] Download progress: ${percent.toFixed(1)}% (${Math.round(
        progressObj?.bytesPerSecond ?? 0
      )} B/s)`
    );
  });

  autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
    const fromRelease =
      typeof releaseName === "string" && releaseName.trim() ? releaseName.trim() : "";
    const fromUpdaterInfo = String(autoUpdater.updateInfo?.version ?? "").trim();
    const downloadedVersion = pendingUpdateVersion || fromRelease || fromUpdaterInfo || "";

    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.setProgressBar(-1);
    }

    const L = getDialogStrings(app);
    const result = dialog.showMessageBoxSync({
      type: "info",
      buttons: [L.installNow, L.later],
      defaultId: 0,
      cancelId: 1,
      title: L.updateTitle,
      message: L.updateDownloaded(downloadedVersion)
    });

    if (result === 0) {
      autoUpdater.quitAndInstall(true, true);
    }
  });

  autoUpdater.on("update-not-available", () => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.setProgressBar(-1);
    }
    // eslint-disable-next-line no-console
    console.log("[Hi-TTS] Aucune mise à jour disponible.");
  });

  const runCheck = (reason) => {
    autoUpdater.checkForUpdates().catch((error) => {
      // eslint-disable-next-line no-console
      console.error(`[Hi-TTS] Impossible de vérifier les mises à jour (${reason})`, error);
    });
  };

  runCheck("boot");

  autoUpdaterIntervalId = setInterval(() => {
    if (autoUpdater.updateInfoAndProvider?.info) {
      return;
    }
    runCheck("periodic");
  }, AUTO_UPDATE_CHECK_INTERVAL_MS);
}

function stopAutoUpdater() {
  if (autoUpdaterIntervalId !== null) {
    clearInterval(autoUpdaterIntervalId);
    autoUpdaterIntervalId = null;
  }
}

module.exports = { setupAutoUpdater, stopAutoUpdater };
