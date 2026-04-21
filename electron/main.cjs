const { app, BrowserWindow, Menu, shell, dialog, nativeTheme, ipcMain, safeStorage } = require("electron");
const path = require("path");
const fsp = require("fs/promises");
const express = require("express");
const { autoUpdater } = require("electron-updater");
const net = require("net");
const { exec } = require("child_process");
const { getDialogStrings, writeStoredLocaleSync } = require("./mainLocale.cjs");

const isDev = !app.isPackaged;
const PORT = 55510;

let serverStarted = false;
let mainWindow = null;
/** Version du correctif en cours de téléchargement (pour l’UI ; `releaseName` GitHub est souvent vide). */
let pendingUpdateVersion = "";
/** Handle du setInterval de revérification auto-update, pour le nettoyer au quit. */
let autoUpdaterIntervalId = null;

/** Fréquence de revérification des mises à jour quand l'app reste ouverte longtemps. */
const AUTO_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 heures

/** Aligné sur `electron/preload.cjs` (ALLOWED_KEYS). */
const SECURE_STORAGE_KEYS = new Set(["hi_tts_secure_tw_token", "hi_tts_secure_eleven"]);

function getSecretsFilePath() {
  return path.join(app.getPath("userData"), "hi-tts-secrets.json");
}

// I/O async pour ne pas bloquer le process main pendant les handlers IPC
// (antivirus / partition lente peuvent faire durer un readFileSync plusieurs
// centaines de ms, figeant l'UI Electron).
async function readSecretsStore() {
  const p = getSecretsFilePath();
  try {
    const raw = await fsp.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    // ENOENT = fichier pas encore créé (premier lancement) → état vide normal.
    if (err && err.code !== "ENOENT") {
      // eslint-disable-next-line no-console
      console.warn("[Hi-TTS] readSecretsStore fallback:", err.code || err.message);
    }
    return {};
  }
}

async function writeSecretsStore(store) {
  const p = getSecretsFilePath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(store), "utf8");
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

function registerLocaleIpc() {
  ipcMain.handle("app-locale:set", (_event, locale) => {
    if (locale !== "fr" && locale !== "en") return;
    writeStoredLocaleSync(app, locale);
  });
}

function registerSecureStorageIpc() {
  ipcMain.handle("secure-storage:get", async (_event, key) => {
    if (!SECURE_STORAGE_KEYS.has(key)) return null;
    const store = await readSecretsStore();
    const packed = store[key];
    if (!packed) return null;
    try {
      return unpackSecret(packed);
    } catch {
      return null;
    }
  });

  ipcMain.handle("secure-storage:set", async (_event, key, plainText) => {
    if (!SECURE_STORAGE_KEYS.has(key)) return;
    const store = await readSecretsStore();
    if (plainText === null || plainText === "") {
      delete store[key];
    } else {
      store[key] = packSecret(plainText);
    }
    await writeSecretsStore(store);
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
            const L = getDialogStrings(app);
            dialog
              .showMessageBox({
                type: "error",
                title: L.portInUseTitle,
                message: L.portInUseMessage(PORT)
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
            const L = getDialogStrings(app);
            dialog
              .showMessageBox({
                type: "error",
                title: L.serverStartErrorTitle,
                message: L.serverStartErrorMessage
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
      message: L.updateAvailable(String(info.version ?? "")),
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
    const fromRelease =
      typeof releaseName === "string" && releaseName.trim() ? releaseName.trim() : "";
    const fromUpdaterInfo = String(autoUpdater.updateInfo?.version ?? "").trim();
    const downloadedVersion =
      pendingUpdateVersion || fromRelease || fromUpdaterInfo || "";

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
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

  // Vérifie au démarrage, déclenche les événements ci-dessus
  runCheck("boot");

  // Revérification périodique : si l'utilisateur laisse l'app ouverte pendant
  // des jours (cas TTS streaming), il recevra la prompt de MAJ sans redémarrer.
  // On évite de relancer quand un téléchargement est déjà en cours / déjà
  // téléchargé (`updateDownloaded` existe dès qu'un package est prêt à
  // installer).
  autoUpdaterIntervalId = setInterval(() => {
    if (autoUpdater.updateInfoAndProvider?.info) {
      // Update déjà détecté / en cours : pas besoin de repoller.
      return;
    }
    runCheck("periodic");
  }, AUTO_UPDATE_CHECK_INTERVAL_MS);
}

app.whenReady().then(() => {
  registerLocaleIpc();
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

app.on("before-quit", () => {
  if (autoUpdaterIntervalId !== null) {
    clearInterval(autoUpdaterIntervalId);
    autoUpdaterIntervalId = null;
  }
});

