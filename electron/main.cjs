const { app, BrowserWindow, Menu } = require("electron");
const { registerLocaleIpc } = require("./localeIpc.cjs");
const { registerSecureStorageIpc } = require("./secureStorage.cjs");
const { createWindow } = require("./windowManager.cjs");
const { setupAutoUpdater, stopAutoUpdater } = require("./autoUpdater.cjs");

const PORT = 55510;

let mainWindow = null;

app.whenReady().then(() => {
  registerLocaleIpc();
  registerSecureStorageIpc();

  Menu.setApplicationMenu(null);

  mainWindow = createWindow({ port: PORT });

  setupAutoUpdater({ getWindow: () => mainWindow });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow({ port: PORT });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopAutoUpdater();
});
