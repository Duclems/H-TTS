const { app, BrowserWindow, Menu, shell, Tray, nativeImage } = require("electron");
const path = require("path");
const express = require("express");

const isDev = !app.isPackaged;
const PORT = 5173;

let serverStarted = false;
let tray = null;
let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 450,
    height: 450,
    minWidth: 450,
    minHeight: 450,
    maxWidth: 450,
    maxHeight: 450,
    title: "H-TTS - Twitch Desktop",
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

  // Minimise vers la zone de notification au lieu de fermer complètement
  win.on("minimize", (event) => {
    event.preventDefault();
    win.hide();
  });

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
        console.log(`[H-TTS] Serveur statique Electron démarré sur http://localhost:${PORT}`);
      });

      serverStarted = true;
    }

    win.loadURL(`http://localhost:${PORT}`);
  }
}

app.whenReady().then(() => {
  // Supprime complètement la barre de menus (File / Edit / View / Window / Help)
  Menu.setApplicationMenu(null);

  createWindow();

  // Icône de zone de notification (tray)
  const trayIcon = nativeImage.createEmpty();
  trayIcon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip("H-TTS - Twitch Desktop");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Afficher H-TTS",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      type: "separator"
    },
    {
      label: "Quitter",
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });

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

