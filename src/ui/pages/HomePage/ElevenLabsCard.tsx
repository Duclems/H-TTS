import { useEffect, useState } from "react";
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

  useEffect(() => {
    const cfg = loadElevenLabsConfig();
    setApiKey(cfg.apiKey);

    if (!cfg.apiKey.trim()) {
      setUserInfo(null);
      return;
    }

    void (async () => {
      const user = await fetchElevenUser();
      if (!user) {
        setUserInfo(null);
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
    })();
  }, []);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    saveElevenLabsConfig({ apiKey: trimmed });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1000);

    if (!trimmed) {
      setUserInfo(null);
      return;
    }

    const user = await fetchElevenUser();
    if (!user) {
      setUserInfo(null);
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
  };

  return (
    <section className="card">
      <div className="card-title">Configuration ElevenLabs</div>

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

      <p className="card-text" style={{ marginTop: userInfo ? "0.6rem" : 0 }}>
        Renseigne ta clé API ElevenLabs. Elle est utilisée pour tous les TTS ; les voix et
        paramètres se configurent par reward (bouton « Paramètres » sur chaque reward à l&apos;accueil).
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
            className="field"
          />
        </div>
      </div>

      <button
        type="button"
        className="twitch-button"
        style={{ marginTop: "0.9rem" }}
        onClick={handleSave}
      >
        Sauvegarder la clé API
      </button>

      {saved && (
        <p className="card-text text-success" style={{ marginTop: "0.4rem" }}>
          Clé sauvegardée localement.
        </p>
      )}
    </section>
  );
};
