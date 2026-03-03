const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const express = require("express");

const isDev = !app.isPackaged;
const PORT = 5173;

let serverStarted = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 450,
    height: 450,
    minWidth: 450,
    minHeight: 450,
    maxWidth: 450,
    maxHeight:450,
    title: "H-TTS - Twitch Desktop",
    backgroundColor: "#1e130b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
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

