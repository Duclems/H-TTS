const { app, BrowserWindow, Menu, shell, dialog, nativeTheme, ipcMain, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const express = require("express");
const { autoUpdater } = require("electron-updater");
const net = require("net");
const { exec } = require("child_process");

const isDev = !app.isPackaged;
const PORT = 55510;

let serverStarted = false;
let mainWindow = null;

/** Aligné sur `electron/preload.cjs` (ALLOWED_KEYS). */
const SECURE_STORAGE_KEYS = new Set(["hi_tts_secure_tw_token", "hi_tts_secure_eleven"]);

function getSecretsFilePath() {
  return path.join(app.getPath("userData"), "hi-tts-secrets.json");
}

function readSecretsStore() {
  const p = getSecretsFilePath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeSecretsStore(store) {
  fs.mkdirSync(path.dirname(getSecretsFilePath()), { recursive: true });
  fs.writeFileSync(getSecretsFilePath(), JSON.stringify(store), "utf8");
}

/**
 * @param {string} plain
 * @returns {{ e: boolean; d: string }}
 */
function packSecret(plain) {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      e: true,
      d: safeStorage.encryptString(plain).toString("base64")
    };
  }
  return { e: false, d: plain };
}

/**
 * @param {{ e?: boolean; d?: string } | null | undefined} entry
 * @returns {string | null}
 */
function unpackSecret(entry) {
  if (!entry || typeof entry !== "object" || typeof entry.d !== "string") {
    return null;
  }
  if (entry.e) {
    return safeStorage.decryptString(Buffer.from(entry.d, "base64"));
  }
  return entry.d;
}

function registerSecureStorageIpc() {
  ipcMain.handle("secure-storage:get", (_event, key) => {
    if (!SECURE_STORAGE_KEYS.has(key)) return null;
    const store = readSecretsStore();
    const packed = store[key];
    if (!packed) return null;
    try {
      return unpackSecret(packed);
    } catch {
      return null;
    }
  });

  ipcMain.handle("secure-storage:set", (_event, key, plainText) => {
    if (!SECURE_STORAGE_KEYS.has(key)) return;
    const store = readSecretsStore();
    if (plainText === null || plainText === "") {
      delete store[key];
    } else {
      store[key] = packSecret(plainText);
    }
    writeSecretsStore(store);
  });

  ipcMain.handle("secure-storage:isEncryptionAvailable", () => safeStorage.isEncryptionAvailable());
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net
      .connect({ port, host: "127.0.0.1" })
      .once("connect", () => {
        socket.end();
        resolve(true);
      })
      .once("error", () => {
        resolve(false);
      });
  });
}

function getPidsOnPort(port) {
  return new Promise((resolve) => {
    // netstat output: ... TCP 127.0.0.1:55510 ... LISTENING PID
    exec(`netstat -ano -p tcp | findstr :${port}`, (err, stdout) => {
      if (err || !stdout) return resolve([]);

      const pids = new Set();
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      resolve(Array.from(pids));
    });
  });
}

function tryKillPid(pid) {
  return new Promise((resolve) => {
    // /F = force, /T = kill child processes
    exec(`taskkill /PID ${pid} /F /T`, () => resolve());
  });
}

async function freePortIfNeeded(port) {
  const open = await isPortOpen(port);
  if (!open) return true;

  const pids = await getPidsOnPort(port);
  if (pids.length === 0) return false;

  // Attempt to free the port by killing the process(es) holding it.
  for (const pid of pids) {
    await tryKillPid(pid);
  }

  // Wait a moment and re-check.
  await new Promise((r) => setTimeout(r, 500));
  return !(await isPortOpen(port));
}

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
    title: "Hi-TTS",
    icon: iconPath,
    backgroundColor: "#1e130b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      // Empêche Chromium de ralentir les timers / audio quand la fenêtre
      // est minimisée ou en arrière-plan, pour que le TTS continue
      // de fonctionner en permanence.
      backgroundThrottling: false
    }
  });

  // Ajoute un header spécial sur toutes les requêtes HTTP émises par la fenêtre
  // pour qu'Express puisse distinguer l'app Electron d'un navigateur externe.
  win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = {
      ...details.requestHeaders,
      "X-Hi-TTS-APP": "1"
    };
    callback({ requestHeaders: headers });
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

      // Middleware de sécurité : bloque tout accès qui ne vient pas de l'app
      staticApp.use((req, res, next) => {
        const headerValue = req.header("X-Hi-TTS-APP");
        if (headerValue === "1") {
          return next();
        }
        res.status(403).send("Forbidden");
      });

      staticApp.use(express.static(distPath));

      staticApp.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });

      // Start server ONLY after we successfully free the port (prevents EADDRINUSE popup).
      void (async () => {
        const ok = await freePortIfNeeded(PORT);
        if (!ok) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            dialog
              .showMessageBox({
                type: "error",
                title: "HI-TTS",
                message:
                  `Port ${PORT} is already in use and could not be freed automatically.\n\n` +
                  "Please close other HI-TTS instances (and any dev server) and restart the app."
              })
              .catch(() => {});
          }
          app.quit();
          return;
        }

        const server = staticApp.listen(PORT, "127.0.0.1", () => {
          // eslint-disable-next-line no-console
          console.log(`[Hi-TTS] Serveur statique Electron démarré sur http://localhost:${PORT}`);
        });

        server.on("error", (err) => {
          // eslint-disable-next-line no-console
          console.error("[Hi-TTS] Express listen error", err);
          if (mainWindow && !mainWindow.isDestroyed()) {
            dialog
              .showMessageBox({
                type: "error",
                title: "HI-TTS",
                message:
                  "Unable to start the internal server (port already in use). " +
                  "Please close other instances and restart."
              })
              .catch(() => {});
          }
          app.quit();
        });

        serverStarted = true;
        win.loadURL(`http://localhost:${PORT}`);
      })();
    }
    else {
      win.loadURL(`http://localhost:${PORT}`);
    }
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
    // eslint-disable-next-line no-console
    console.error("[Hi-TTS] Erreur auto-update", error);
  });

  autoUpdater.on("update-available", (info) => {
    // eslint-disable-next-line no-console
    console.log("[Hi-TTS] Mise à jour disponible", info.version);

    const result = dialog.showMessageBoxSync({
      type: "info",
      buttons: ["Télécharger maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      title: "Mise à jour Hi-TTS",
      message: `Une nouvelle version de Hi-TTS est disponible (${info.version}).`,
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(percent / 100);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[Hi-TTS] Download progress: ${percent.toFixed(1)}% (${Math.round(
        progressObj?.bytesPerSecond ?? 0
      )} B/s)`
    );
  });

  autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
    const downloadedVersion =
      typeof releaseName === "string" && releaseName.trim()
        ? releaseName.trim()
        : "new version";

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }

    const result = dialog.showMessageBoxSync({
      type: "info",
      buttons: ["Redémarrer maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      title: "Mise à jour Hi-TTS",
      message: `Une nouvelle version de Hi-TTS a été téléchargée (${downloadedVersion}).`,
      detail: "Redémarrer l'application pour appliquer la mise à jour."
    });

    if (result === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("update-not-available", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
    // eslint-disable-next-line no-console
    console.log("[Hi-TTS] Aucune mise à jour disponible.");
    dialog.showMessageBox({
      type: "info",
      title: "Mise à jour Hi-TTS",
      message: "Aucune mise à jour disponible pour le moment.",
    }).catch(() => {
      // ignore dialog errors
    });
  });

  // Vérifie au démarrage, déclenche les événements ci-dessus
  autoUpdater.checkForUpdates().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[Hi-TTS] Impossible de vérifier les mises à jour", error);
  });
}

app.whenReady().then(() => {
  registerSecureStorageIpc();

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

