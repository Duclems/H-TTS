const { ipcMain, shell } = require("electron");
const crypto = require("crypto");

const TWITCH_DEVICE_URL = "https://id.twitch.tv/oauth2/device";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

const MAX_CONCURRENT_SESSIONS = 4;

/**
 * @typedef {Object} DeviceFlowSession
 * @property {string} id
 * @property {string} deviceCode
 * @property {number} interval
 * @property {number} expiresAt
 * @property {string} clientId
 * @property {string} scopes
 * @property {boolean} cancelled
 * @property {AbortController} abortController
 */

/** @type {Map<string, DeviceFlowSession>} */
const sessions = new Map();

function buildSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

function newAbortableTimeout(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(undefined);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort);
  });
}

function isHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function postForm(url, body, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    signal
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore, will be handled below
  }
  return { status: res.status, ok: res.ok, json, text };
}

async function startDeviceFlow({ clientId, scopes }) {
  if (typeof clientId !== "string" || !clientId) {
    throw new Error("invalid_client_id");
  }
  if (typeof scopes !== "string") {
    throw new Error("invalid_scopes");
  }

  if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
    for (const s of sessions.values()) {
      s.abortController.abort();
      sessions.delete(s.id);
      if (sessions.size < MAX_CONCURRENT_SESSIONS) break;
    }
  }

  const abortController = new AbortController();
  const { status, ok, json } = await postForm(
    TWITCH_DEVICE_URL,
    { client_id: clientId, scopes },
    abortController.signal
  );

  if (!ok || !json || typeof json.device_code !== "string") {
    const msg =
      json && typeof json.message === "string"
        ? json.message
        : `device_request_failed_${status}`;
    throw new Error(msg);
  }

  const id = buildSessionId();
  /** @type {DeviceFlowSession} */
  const session = {
    id,
    deviceCode: json.device_code,
    interval: Math.max(1, Number(json.interval) || 5),
    expiresAt: Date.now() + Math.max(30, Number(json.expires_in) || 1800) * 1000,
    clientId,
    scopes,
    cancelled: false,
    abortController
  };
  sessions.set(id, session);

  return {
    sessionId: id,
    userCode: typeof json.user_code === "string" ? json.user_code : "",
    verificationUri: typeof json.verification_uri === "string" ? json.verification_uri : "",
    expiresIn: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
    interval: session.interval
  };
}

async function pollSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("unknown_session");

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (session.cancelled) throw new Error("cancelled");
      if (Date.now() >= session.expiresAt) throw new Error("expired");

      const { ok, json, status } = await postForm(
        TWITCH_TOKEN_URL,
        {
          client_id: session.clientId,
          scopes: session.scopes,
          device_code: session.deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code"
        },
        session.abortController.signal
      );

      if (ok && json && typeof json.access_token === "string") {
        return normalizeTokenResponse(json);
      }

      const msg =
        json && typeof json.message === "string" ? json.message.toLowerCase() : "";

      if (msg.includes("authorization_pending") || status === 400) {
        // user has not yet authorized — keep polling
      } else if (msg.includes("slow_down")) {
        session.interval += 5;
      } else if (msg.includes("access_denied") || msg.includes("expired")) {
        throw new Error(msg || "access_denied");
      } else if (status === 400) {
        // generic 400 without message → treat as pending
      } else if (status === 401 || status === 403) {
        throw new Error(msg || "unauthorized");
      }

      await newAbortableTimeout(session.interval * 1000, session.abortController.signal);
    }
  } finally {
    sessions.delete(sessionId);
  }
}

function cancelSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.cancelled = true;
  session.abortController.abort();
  sessions.delete(sessionId);
}

function normalizeTokenResponse(raw) {
  const expiresIn =
    typeof raw.expires_in === "number" && Number.isFinite(raw.expires_in)
      ? raw.expires_in
      : 0;
  const scopeArr = Array.isArray(raw.scope)
    ? raw.scope.filter((s) => typeof s === "string")
    : typeof raw.scope === "string"
      ? raw.scope.split(" ").filter(Boolean)
      : [];
  return {
    access_token: String(raw.access_token || ""),
    refresh_token: typeof raw.refresh_token === "string" ? raw.refresh_token : null,
    token_type: typeof raw.token_type === "string" ? raw.token_type : "bearer",
    scope: scopeArr,
    expires_in: expiresIn,
    expires_at: Date.now() + expiresIn * 1000
  };
}

async function refreshToken({ clientId, refreshToken: refresh }) {
  if (typeof clientId !== "string" || !clientId) throw new Error("invalid_client_id");
  if (typeof refresh !== "string" || !refresh) throw new Error("invalid_refresh_token");

  const abortController = new AbortController();
  const { ok, json, status } = await postForm(
    TWITCH_TOKEN_URL,
    {
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refresh
    },
    abortController.signal
  );

  if (!ok || !json || typeof json.access_token !== "string") {
    const msg =
      json && typeof json.message === "string"
        ? json.message
        : `refresh_failed_${status}`;
    const err = new Error(msg);
    // @ts-ignore
    err.status = status;
    throw err;
  }

  return normalizeTokenResponse(json);
}

function openVerification(url) {
  if (!isHttpsUrl(url)) return false;
  const parsed = new URL(url);
  if (parsed.hostname !== "www.twitch.tv" && parsed.hostname !== "twitch.tv") {
    return false;
  }
  shell.openExternal(url).catch(() => {});
  return true;
}

function registerTwitchOAuthIpc() {
  ipcMain.handle("twitch-oauth:start", async (_event, args) => {
    try {
      return { ok: true, data: await startDeviceFlow(args || {}) };
    } catch (err) {
      return { ok: false, error: err && err.message ? String(err.message) : "unknown_error" };
    }
  });

  ipcMain.handle("twitch-oauth:wait", async (_event, sessionId) => {
    try {
      const token = await pollSession(String(sessionId || ""));
      return { ok: true, data: token };
    } catch (err) {
      return { ok: false, error: err && err.message ? String(err.message) : "unknown_error" };
    }
  });

  ipcMain.handle("twitch-oauth:cancel", (_event, sessionId) => {
    cancelSession(String(sessionId || ""));
    return true;
  });

  ipcMain.handle("twitch-oauth:refresh", async (_event, args) => {
    try {
      return { ok: true, data: await refreshToken(args || {}) };
    } catch (err) {
      return {
        ok: false,
        error: err && err.message ? String(err.message) : "unknown_error",
        status: err && err.status ? err.status : undefined
      };
    }
  });

  ipcMain.handle("twitch-oauth:open-verification", (_event, url) => {
    return openVerification(String(url || ""));
  });
}

function stopAllSessions() {
  for (const session of sessions.values()) {
    session.cancelled = true;
    session.abortController.abort();
  }
  sessions.clear();
}

module.exports = { registerTwitchOAuthIpc, stopAllSessions };
