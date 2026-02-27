const { app, BrowserWindow } = require("electron");
const path = require("path");
const express = require("express");

const isDev = !app.isPackaged;
const PORT = 5173;

let serverStarted = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: "H-TTS - Twitch Desktop",
    backgroundColor: "#050816",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (isDev) {
    win.loadURL(`http://localhost:${PORT}`);
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

