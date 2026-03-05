import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { loadElevenLabsConfig, saveElevenLabsConfig } from "../../../elevenLabsConfig";
import { fetchElevenUser, checkElevenPermissions } from "../../../elevenLabsApi";

const LAST_ALL_OK_KEY = "h_tts_eleven_last_all_ok";
const LAST_USER_KEY = "h_tts_eleven_last_user";

function getInitialApiKey(): string {
  return loadElevenLabsConfig().apiKey ?? "";
}

function getInitialOptimisticAllOk(): boolean {
  const cfg = loadElevenLabsConfig();
  const key = cfg.apiKey?.trim();
  if (!key) return false;
  return window.localStorage.getItem(LAST_ALL_OK_KEY) === "true";
}

type ElevenUserInfo = {
  name: string;
  avatarUrl: string | null;
  remainingCharacters: number | null;
  characterLimit: number | null;
};

function saveLastUserInfo(info: ElevenUserInfo | null): void {
  if (info) {
    try {
      window.localStorage.setItem(LAST_USER_KEY, JSON.stringify(info));
    } catch {
      window.localStorage.removeItem(LAST_USER_KEY);
    }
  } else {
    window.localStorage.removeItem(LAST_USER_KEY);
  }
}

function getInitialUserInfo(): ElevenUserInfo | null {
  if (!getInitialApiKey().trim()) return null;
  try {
    const raw = window.localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ElevenUserInfo;
    if (typeof parsed?.name !== "string") return null;
    return {
      name: parsed.name,
      avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : null,
      remainingCharacters:
        typeof parsed.remainingCharacters === "number" ? parsed.remainingCharacters : null,
      characterLimit: typeof parsed.characterLimit === "number" ? parsed.characterLimit : null
    };
  } catch {
    return null;
  }
}

export const ElevenLabsCard = () => {
  const [apiKey, setApiKey] = useState(getInitialApiKey);
  const [saved, setSaved] = useState(false);
  const [userInfo, setUserInfo] = useState<ElevenUserInfo | null>(getInitialUserInfo);
  const [loadingUser, setLoadingUser] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [permissionChecks, setPermissionChecks] = useState<{
    user: boolean;
    voices: boolean;
    tts: boolean;
  } | null>(null);
  const [permissionChecksLoading, setPermissionChecksLoading] = useState(false);
  const [optimisticAllOk, setOptimisticAllOk] = useState(getInitialOptimisticAllOk);

  useEffect(() => {
    const cfg = loadElevenLabsConfig();
    setApiKey(cfg.apiKey);

    if (!cfg.apiKey.trim()) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(false);
      window.localStorage.setItem(LAST_ALL_OK_KEY, "false");
      return;
    }

    const invalidKey = window.localStorage.getItem("h_tts_eleven_invalid_key");
    if (invalidKey && invalidKey === cfg.apiKey) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(true);
      window.localStorage.setItem(LAST_ALL_OK_KEY, "false");
      return;
    }

    void (async () => {
      setLoadingUser(true);
      setHasError(false);
      const user = await fetchElevenUser();
      if (!user) {
        setUserInfo(null);
        saveLastUserInfo(null);
        setLoadingUser(false);
        setHasError(true);
        setOptimisticAllOk(false);
        window.localStorage.setItem("h_tts_eleven_invalid_key", cfg.apiKey);
        window.localStorage.setItem(LAST_ALL_OK_KEY, "false");
        return;
      }

      const avatarUrl = (user as any).profile_picture ?? (user as any).image_url ?? null;
      const subscription = user.subscription;
      const remaining =
        subscription && typeof subscription.character_limit === "number"
          ? subscription.character_limit - (subscription.character_count ?? 0)
          : null;

      const info: ElevenUserInfo = {
        name: (user as any).first_name || "Compte ElevenLabs",
        avatarUrl,
        remainingCharacters: remaining,
        characterLimit: subscription?.character_limit ?? null
      };
      setUserInfo(info);
      saveLastUserInfo(info);
      setLoadingUser(false);
      setHasError(false);
      window.localStorage.removeItem("h_tts_eleven_invalid_key");
    })();
  }, []);

  useEffect(() => {
    if (!userInfo) {
      setPermissionChecks(null);
      return;
    }
    setPermissionChecksLoading(true);
    void checkElevenPermissions().then((checks) => {
      const allOk = checks.user && checks.voices && checks.tts;
      setPermissionChecks(checks);
      setPermissionChecksLoading(false);
      setOptimisticAllOk(allOk);
      window.localStorage.setItem(LAST_ALL_OK_KEY, allOk ? "true" : "false");
    });
  }, [userInfo]);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    saveElevenLabsConfig({ apiKey: trimmed });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1000);

    if (!trimmed) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(false);
      setOptimisticAllOk(false);
      window.localStorage.removeItem("h_tts_eleven_invalid_key");
      window.localStorage.setItem(LAST_ALL_OK_KEY, "false");
      return;
    }

    const invalidKey = window.localStorage.getItem("h_tts_eleven_invalid_key");
    if (invalidKey && invalidKey === trimmed) {
      // On ne retente pas tant que la clé n'a pas changé
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(true);
      setOptimisticAllOk(false);
      return;
    }

    setLoadingUser(true);
    setHasError(false);
    const user = await fetchElevenUser();
    if (!user) {
      setUserInfo(null);
      saveLastUserInfo(null);
      setLoadingUser(false);
      setHasError(true);
      setOptimisticAllOk(false);
      window.localStorage.setItem("h_tts_eleven_invalid_key", trimmed);
      window.localStorage.setItem(LAST_ALL_OK_KEY, "false");
      return;
    }

    const avatarUrl = (user as any).profile_picture ?? (user as any).image_url ?? null;
    const subscription = user.subscription;
    const remaining =
      subscription && typeof subscription.character_limit === "number"
        ? subscription.character_limit - (subscription.character_count ?? 0)
        : null;

    const info: ElevenUserInfo = {
      name: (user as any).first_name || "Compte ElevenLabs",
      avatarUrl,
      remainingCharacters: remaining,
      characterLimit: subscription?.character_limit ?? null
    };
    setUserInfo(info);
    saveLastUserInfo(info);
    setLoadingUser(false);
    setHasError(false);
    window.localStorage.removeItem("h_tts_eleven_invalid_key");
  };

  return (
    <section className="card">
      {loadingUser && !userInfo && (
        <div className="eleven-user-header">
          <div className="eleven-user-avatar">
            <div className="skeleton skeleton-avatar" />
          </div>
          <div className="eleven-user-meta">
            <div
              className="skeleton skeleton-line skeleton-line-main"
              style={{ "--skeleton-line-height": "10px" } as CSSProperties}
            />
            <div
              className="skeleton skeleton-line skeleton-line-small"
              style={{ "--skeleton-line-height": "8px" } as CSSProperties}
            />
          </div>
        </div>
      )}
      {userInfo && (
        <div className="eleven-user-header">
          <div className="eleven-user-avatar">
            {userInfo.avatarUrl ? (
              <img src={userInfo.avatarUrl} alt={userInfo.name} />
            ) : (
              <span>{userInfo.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="eleven-user-meta">
            <div className="eleven-user-name">{userInfo.name}</div>
            {userInfo.remainingCharacters != null && userInfo.characterLimit != null && (
              <div className="eleven-user-credits">
                Crédits restants :{" "}
                {userInfo.remainingCharacters.toLocaleString("fr-FR")} /{" "}
                {userInfo.characterLimit.toLocaleString("fr-FR")} caractères
              </div>
            )}
          </div>
        </div>
      )}

      {!((optimisticAllOk && !hasError) || (userInfo && permissionChecks && permissionChecks.user && permissionChecks.voices && permissionChecks.tts)) && (
        <>
          <p className="card-text" style={{ marginTop: userInfo || loadingUser ? "0.6rem" : 0 }}>
            Récupère ta clé API ElevenLabs. Elle est utilisée pour tous les TTS.
            <br />
            Tu peux la récupérer depuis{" "}
            <a
              href="https://elevenlabs.io/app/developers/api-keys"
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "underline dotted" }}
            >
              la page des clés API ElevenLabs
            </a>
            .
          </p>
          <p className="card-text" style={{ marginTop: userInfo || loadingUser ? "0.6rem" : 0 }}>
            Sélectionne les champs suivants pour configurer le TTS :
          </p>

          {(userInfo || permissionChecksLoading || hasError || !apiKey.trim()) && (
            <div className="token-chip-row" style={{ marginTop: "0.4rem" }}>
              <span
                className={
                  hasError || !apiKey.trim()
                    ? "token-chip token-chip-danger"
                    : permissionChecksLoading
                      ? "token-chip"
                      : permissionChecks?.tts === false
                        ? "token-chip token-chip-danger"
                        : "token-chip"
                }
              >
                Text to Speech
              </span>
              <span
                className={
                  hasError || !apiKey.trim()
                    ? "token-chip token-chip-danger"
                    : permissionChecksLoading
                      ? "token-chip"
                      : permissionChecks?.voices === false
                        ? "token-chip token-chip-danger"
                        : "token-chip"
                }
              >
                Voix
              </span>
              <span
                className={
                  hasError || !apiKey.trim()
                    ? "token-chip token-chip-danger"
                    : permissionChecksLoading
                      ? "token-chip"
                      : permissionChecks?.user === false
                        ? "token-chip token-chip-danger"
                        : "token-chip"
                }
              >
                Utilisateur
              </span>
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.6rem" }}>
        <div>
          <label
            htmlFor="eleven-api-key"
            style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}
          >
            Clé API ElevenLabs
          </label>
          <input
            id="eleven-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk_..."
            className={hasError ? "field field-error" : "field"}
          />
        </div>
      </div>

      <button
        type="button"
        className={
          !apiKey.trim() ||
          hasError ||
          (permissionChecks &&
            (permissionChecks.user === false ||
              permissionChecks.voices === false ||
              permissionChecks.tts === false))
            ? "twitch-button btn-danger"
            : "twitch-button"
        }
        style={{ marginTop: "0.9rem" }}
        onClick={handleSave}
      >
        Sauvegarder
      </button>

      {saved && (
        <p className="card-text text-success" style={{ marginTop: "0.4rem" }}>
          Clé sauvegardée localement.
        </p>
      )}
    </section>
  );
};
