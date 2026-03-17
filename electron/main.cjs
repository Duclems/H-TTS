const { app, BrowserWindow, Menu, shell, dialog, nativeTheme } = require("electron");
const path = require("path");
const express = require("express");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;
const PORT = 55510;

let serverStarted = false;
let mainWindow = null;

function getIconPath() {
  // Icône de la fenêtre (et donc de la barre des tâches) : adaptée au thème
  const prefersDark = nativeTheme.shouldUseDarkColors;
  // Thème sombre -> icône claire, thème clair -> icône sombre
  const fileName = prefersDark ? "hi-tts-light.ico" : "hi-tts-dark.ico";

  return isDev
    ? path.join(__dirname, "..", "public", "logos", fileName)
    : path.join(__dirname, "..", "dist", "logos", fileName);
}

function createWindow() {
  const iconPath = getIconPath();

  const win = new BrowserWindow({
    width: 450,
    height: 450,
    minWidth: 450,
    minHeight: 450,
    maxWidth: 450,
    maxHeight: 450,
    title: "HI-TTS",
    icon: iconPath,
    backgroundColor: "#1e130b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Empêche Chromium de ralentir les timers / audio quand la fenêtre
      // est minimisée ou en arrière-plan, pour que le TTS continue
      // de fonctionner en permanence.
      backgroundThrottling: false
    }
  });

  mainWindow = win;

  // Ouvre tous les liens externes (target=_blank / window.open) dans le navigateur par défaut
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL(`http://localhost:${PORT}`);

    // Ouvre les DevTools dans une fenêtre séparée en mode développement
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    if (!serverStarted) {
      const staticApp = express();
      const distPath = path.join(__dirname, "..", "dist");
      staticApp.use(express.static(distPath));

      staticApp.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });

      staticApp.listen(PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`[HI-TTS] Serveur statique Electron démarré sur http://localhost:${PORT}`);
      });

      serverStarted = true;
    }

    win.loadURL(`http://localhost:${PORT}`);
  }
}

function setupAutoUpdater() {
  if (isDev) {
    // Pas de mise à jour auto en mode développement
    return;
  }

  // On ne télécharge pas automatiquement : on demande d'abord l'accord
  autoUpdater.autoDownload = false;

  autoUpdater.on("error", (error) => {
    // eslint-disable-next-line no-console
    console.error("[HI-TTS] Erreur auto-update", error);
  });

  autoUpdater.on("update-available", (info) => {
    // eslint-disable-next-line no-console
    console.log("[HI-TTS] Mise à jour disponible", info.version);

    const result = dialog.showMessageBoxSync({
      type: "info",
      buttons: ["Télécharger maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      title: "Mise à jour HI-TTS",
      message: `Une nouvelle version de HI-TTS est disponible (${info.version}).`,
    });

    if (result === 0) {
      autoUpdater.downloadUpdate().catch((error) => {
        // eslint-disable-next-line no-console
        console.error("[HI-TTS] Erreur lors du téléchargement de la mise à jour", error);
      });
    }
  });

  autoUpdater.on("update-downloaded", (_event, _releaseNotes) => {
    const result = dialog.showMessageBoxSync({
      type: "info",
      buttons: ["Redémarrer maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      title: "Mise à jour HI-TTS",
      message: `Une nouvelle version de HI-TTS a été téléchargée (${info.version}).`,
      detail: "Redémarrer l'application pour appliquer la mise à jour."
    });

    if (result === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  // Vérifie au démarrage, déclenche les événements ci-dessus
  autoUpdater.checkForUpdates().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[HI-TTS] Impossible de vérifier les mises à jour", error);
  });
}

app.whenReady().then(() => {
  // Supprime complètement la barre de menus (File / Edit / View / Window / Help)
  Menu.setApplicationMenu(null);

  createWindow();

  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

