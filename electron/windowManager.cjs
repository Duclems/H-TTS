const { app, BrowserWindow, nativeTheme } = require("electron");
const path = require("path");
const { startStaticServer } = require("./staticServer.cjs");

const isDev = !app.isPackaged;

function getIconPath() {
  const prefersDark = nativeTheme.shouldUseDarkColors;
  const fileName = prefersDark ? "hi-tts-light.ico" : "hi-tts-dark.ico";

  return isDev
    ? path.join(__dirname, "..", "public", "logos", fileName)
    : path.join(__dirname, "..", "dist", "logos", fileName);
}

let serverStarted = false;

function createWindow({ port }) {
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
      backgroundThrottling: false
    }
  });

  const localOrigins = [`http://localhost:${port}/`, `http://127.0.0.1:${port}/`];
  const filter = { urls: localOrigins.map((origin) => `${origin}*`) };

  win.webContents.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const isLocal = localOrigins.some((origin) => details.url.startsWith(origin));
    if (!isLocal) {
      callback({ requestHeaders: details.requestHeaders });
      return;
    }
    const headers = {
      ...details.requestHeaders,
      "X-Hi-TTS-APP": "1"
    };
    callback({ requestHeaders: headers });
  });

  if (isDev) {
    win.loadURL(`http://localhost:${port}`);
    win.webContents.openDevTools({ mode: "detach" });
  } else if (!serverStarted) {
    serverStarted = true;
    void startStaticServer({ port, window: win });
  } else {
    win.loadURL(`http://localhost:${port}`);
  }

  return win;
}

module.exports = { createWindow };
