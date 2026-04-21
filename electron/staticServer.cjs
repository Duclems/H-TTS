const { app, dialog } = require("electron");
const path = require("path");
const express = require("express");
const { freePortIfNeeded } = require("./portHelpers.cjs");
const { getDialogStrings } = require("./mainLocale.cjs");

async function startStaticServer({ port, window }) {
  const staticApp = express();
  const distPath = path.join(__dirname, "..", "dist");

  staticApp.use((req, res, next) => {
    const headerValue = req.header("X-Hi-TTS-APP");
    if (headerValue === "1") return next();
    res.status(403).send("Forbidden");
  });

  staticApp.use(express.static(distPath));

  staticApp.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  const ok = await freePortIfNeeded(port);
  if (!ok) {
    if (window && !window.isDestroyed()) {
      const L = getDialogStrings(app);
      dialog
        .showMessageBox({
          type: "error",
          title: L.portInUseTitle,
          message: L.portInUseMessage(port)
        })
        .catch(() => {});
    }
    app.quit();
    return false;
  }

  const server = staticApp.listen(port, "127.0.0.1", () => {
    // eslint-disable-next-line no-console
    console.log(`[Hi-TTS] Serveur statique Electron démarré sur http://localhost:${port}`);
  });

  server.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[Hi-TTS] Express listen error", err);
    if (window && !window.isDestroyed()) {
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

  window.loadURL(`http://localhost:${port}`);
  return true;
}

module.exports = { startStaticServer };
