const { app, BrowserWindow, nativeTheme } = require("electron");
const path = require("path");
const { startStaticServer } = require("./staticServer.cjs");

const isDev = !app.isPackaged;

/**
 * Content-Security-Policy appliquée à toutes les réponses HTTP(S) servies
 * à la fenêtre principale (dev Vite + serveur statique de prod).
 *
 * Hôtes autorisés :
 * - img-src : avatars, emotes et images de rewards hébergés sur le CDN Twitch
 *   (`static-cdn.jtvnw.net`) ; `data:` pour les icônes/SVG inlinés éventuels.
 * - media-src : `blob:` pour l'audio TTS retourné par ElevenLabs et joué via
 *   `URL.createObjectURL(...)` (`elevenLabsApi.ts`).
 * - connect-src : API REST Twitch / ElevenLabs, WebSocket EventSub et IRC
 *   chat (tmi.js). Les appels `id.twitch.tv/oauth2/*` sont faits depuis le
 *   process main Node, ils n'ont donc pas besoin d'être listés ici.
 * - style-src : `'unsafe-inline'` est requis par React (attribut `style` +
 *   styles injectés par Vite) ; sans scripts inline, le risque résiduel est
 *   limité à l'exfiltration par CSS, considérée acceptable ici.
 * - script-src : `'self'` uniquement (contextIsolation + nodeIntegration:false
 *   déjà en place, pas de CDN de scripts externes).
 * - object-src / base-uri / frame-ancestors : coupent les vecteurs classiques
 *   de détournement (plugins, base tag, clickjacking).
 */
const CSP_PROD = [
  "default-src 'self'",
  "img-src 'self' data: https://static-cdn.jtvnw.net",
  "media-src 'self' blob:",
  "connect-src 'self' https://api.twitch.tv https://api.elevenlabs.io wss://eventsub.wss.twitch.tv wss://irc-ws.chat.twitch.tv",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join("; ");

/**
 * En dev, Vite injecte un preamble inline (React Fast Refresh) et utilise un
 * WebSocket HMR. On doit donc autoriser `'unsafe-inline'` + `'unsafe-eval'`
 * pour les scripts et élargir connect-src au WS local. Cette policy n'est
 * jamais servie en prod (voir `isDev`).
 */
const CSP_DEV = [
  "default-src 'self'",
  "img-src 'self' data: https://static-cdn.jtvnw.net",
  "media-src 'self' blob:",
  "connect-src 'self' ws://localhost:* ws://127.0.0.1:* https://api.twitch.tv https://api.elevenlabs.io wss://eventsub.wss.twitch.tv wss://irc-ws.chat.twitch.tv",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join("; ");

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

  const cspHeaderValue = isDev ? CSP_DEV : CSP_PROD;
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders || {}) };
    for (const key of Object.keys(responseHeaders)) {
      if (key.toLowerCase() === "content-security-policy") {
        delete responseHeaders[key];
      }
    }
    responseHeaders["Content-Security-Policy"] = [cspHeaderValue];
    callback({ responseHeaders });
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
