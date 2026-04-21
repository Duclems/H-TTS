const { app, shell } = require("electron");

/**
 * Origines autorisées pour la BrowserWindow principale (celle qui a le preload
 * et accès à `hiTtsSecureStorage`). Toute navigation vers une autre origine
 * est bloquée (et redirigée vers le navigateur système si c'est un protocole web).
 *
 * Attention : garder cette liste la plus restrictive possible. L'auth Twitch
 * passe par le Device Code Flow (fenêtre externe), donc on n'a **plus** besoin
 * d'autoriser `id.twitch.tv` ici.
 */
const ALLOWED_RENDERER_ORIGINS = new Set([
  "http://localhost:55510",
  "http://127.0.0.1:55510"
]);

const EXTERNAL_WEB_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function isAllowedRendererUrl(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_RENDERER_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

function isExternalWebUrl(url) {
  try {
    const parsed = new URL(url);
    return EXTERNAL_WEB_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Branche les garde-fous de navigation sur tout `WebContents` créé par l'app.
 * Doit être appelé **une seule fois**, après `app.whenReady()`.
 */
function installNavigationGuard() {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-navigate", (event, url) => {
      if (isAllowedRendererUrl(url)) return;
      event.preventDefault();
      if (isExternalWebUrl(url)) {
        shell.openExternal(url).catch(() => {});
      }
    });

    contents.on("will-redirect", (event, url) => {
      if (isAllowedRendererUrl(url)) return;
      event.preventDefault();
      if (isExternalWebUrl(url)) {
        shell.openExternal(url).catch(() => {});
      }
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (isExternalWebUrl(url)) {
        shell.openExternal(url).catch(() => {});
      }
      return { action: "deny" };
    });

    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });

    contents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
      callback(false);
    });

    contents.session.setPermissionCheckHandler(() => false);
  });
}

module.exports = {
  installNavigationGuard,
  ALLOWED_RENDERER_ORIGINS
};
