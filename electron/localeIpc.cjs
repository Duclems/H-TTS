const { app, ipcMain } = require("electron");
const { writeStoredLocaleSync } = require("./mainLocale.cjs");

function registerLocaleIpc() {
  ipcMain.handle("app-locale:set", (_event, locale) => {
    if (locale !== "fr" && locale !== "en") return;
    writeStoredLocaleSync(app, locale);
  });
}

module.exports = { registerLocaleIpc };
