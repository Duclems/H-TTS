import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { loadElevenLabsConfig, saveElevenLabsConfig } from "../../../elevenLabsConfig";
import { fetchElevenUser } from "../../../elevenLabsApi";

type ElevenUserInfo = {
  name: string;
  avatarUrl: string | null;
  remainingCharacters: number | null;
  characterLimit: number | null;
};

export const ElevenLabsCard = () => {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [userInfo, setUserInfo] = useState<ElevenUserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const cfg = loadElevenLabsConfig();
    setApiKey(cfg.apiKey);

    if (!cfg.apiKey.trim()) {
      setUserInfo(null);
      setLoadingUser(false);
      setHasError(false);
      return;
    }

    const invalidKey = window.localStorage.getItem("h_tts_eleven_invalid_key");
    if (invalidKey && invalidKey === cfg.apiKey) {
      setUserInfo(null);
      setLoadingUser(false);
      setHasError(true);
      return;
    }

    void (async () => {
      setLoadingUser(true);
      setHasError(false);
      const user = await fetchElevenUser();
      if (!user) {
        setUserInfo(null);
        setLoadingUser(false);
        setHasError(true);
        window.localStorage.setItem("h_tts_eleven_invalid_key", cfg.apiKey);
        return;
      }

      const avatarUrl = (user as any).profile_picture ?? (user as any).image_url ?? null;
      const subscription = user.subscription;
      const remaining =
        subscription && typeof subscription.character_limit === "number"
          ? subscription.character_limit - (subscription.character_count ?? 0)
          : null;

      setUserInfo({
        name: (user as any).first_name || "Compte ElevenLabs",
        avatarUrl,
        remainingCharacters: remaining,
        characterLimit: subscription?.character_limit ?? null
      });
      setLoadingUser(false);
      setHasError(false);
      window.localStorage.removeItem("h_tts_eleven_invalid_key");
    })();
  }, []);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    saveElevenLabsConfig({ apiKey: trimmed });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1000);

    if (!trimmed) {
      setUserInfo(null);
      setLoadingUser(false);
      setHasError(false);
      window.localStorage.removeItem("h_tts_eleven_invalid_key");
      return;
    }

    const invalidKey = window.localStorage.getItem("h_tts_eleven_invalid_key");
    if (invalidKey && invalidKey === trimmed) {
      // On ne retente pas tant que la clé n'a pas changé
      setUserInfo(null);
      setLoadingUser(false);
      setHasError(true);
      return;
    }

    setLoadingUser(true);
    setHasError(false);
    const user = await fetchElevenUser();
    if (!user) {
      setUserInfo(null);
      setLoadingUser(false);
      setHasError(true);
      window.localStorage.setItem("h_tts_eleven_invalid_key", trimmed);
      return;
    }

    const avatarUrl = (user as any).profile_picture ?? (user as any).image_url ?? null;
    const subscription = user.subscription;
    const remaining =
      subscription && typeof subscription.character_limit === "number"
        ? subscription.character_limit - (subscription.character_count ?? 0)
        : null;

    setUserInfo({
      name: (user as any).first_name || "Compte ElevenLabs",
      avatarUrl,
      remainingCharacters: remaining,
      characterLimit: subscription?.character_limit ?? null
    });
    setLoadingUser(false);
    setHasError(false);
    window.localStorage.removeItem("h_tts_eleven_invalid_key");
  };

  return (
    <section className="card">
      {loadingUser && (
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

      <p className="card-text" style={{ marginTop: userInfo || loadingUser ? "0.6rem" : 0 }}>
        Renseigne ta clé API ElevenLabs. Elle est utilisée pour tous les TTS.
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
        className="twitch-button"
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
