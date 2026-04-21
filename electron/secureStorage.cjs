const { app, ipcMain, safeStorage } = require("electron");
const path = require("path");
const fsp = require("fs/promises");

const SECURE_STORAGE_KEYS = new Set(["hi_tts_secure_tw_token", "hi_tts_secure_eleven"]);

function getSecretsFilePath() {
  return path.join(app.getPath("userData"), "hi-tts-secrets.json");
}

async function readSecretsStore() {
  const p = getSecretsFilePath();
  try {
    const raw = await fsp.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      // eslint-disable-next-line no-console
      console.warn("[Hi-TTS] readSecretsStore fallback:", err.code || err.message);
    }
    return {};
  }
}

async function writeSecretsStore(store) {
  const p = getSecretsFilePath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(store), "utf8");
}

function packSecret(plain) {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      e: true,
      d: safeStorage.encryptString(plain).toString("base64")
    };
  }
  return { e: false, d: plain };
}

function unpackSecret(entry) {
  if (!entry || typeof entry !== "object" || typeof entry.d !== "string") {
    return null;
  }
  if (entry.e) {
    return safeStorage.decryptString(Buffer.from(entry.d, "base64"));
  }
  return entry.d;
}

function registerSecureStorageIpc() {
  ipcMain.handle("secure-storage:get", async (_event, key) => {
    if (!SECURE_STORAGE_KEYS.has(key)) return null;
    const store = await readSecretsStore();
    const packed = store[key];
    if (!packed) return null;
    try {
      return unpackSecret(packed);
    } catch {
      return null;
    }
  });

  ipcMain.handle("secure-storage:set", async (_event, key, plainText) => {
    if (!SECURE_STORAGE_KEYS.has(key)) return;
    const store = await readSecretsStore();
    if (plainText === null || plainText === "") {
      delete store[key];
    } else {
      store[key] = packSecret(plainText);
    }
    await writeSecretsStore(store);
  });

  ipcMain.handle("secure-storage:isEncryptionAvailable", () => safeStorage.isEncryptionAvailable());
}

module.exports = { registerSecureStorageIpc };
