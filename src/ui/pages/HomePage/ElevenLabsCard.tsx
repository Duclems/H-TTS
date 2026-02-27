import { useEffect, useState } from "react";
import { loadElevenLabsConfig, saveElevenLabsConfig } from "../../../elevenLabsConfig";

export const ElevenLabsCard = () => {
  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cfg = loadElevenLabsConfig();
    setApiKey(cfg.apiKey);
    setVoiceId(cfg.voiceId);
  }, []);

  const handleSave = () => {
    const existing = loadElevenLabsConfig();
    saveElevenLabsConfig({
      ...existing,
      apiKey: apiKey.trim(),
      voiceId: voiceId.trim()
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="card">
      <div className="card-title">Configuration ElevenLabs</div>
      <p className="card-text">
        Renseigne ta clé API ElevenLabs et l&apos;identifiant de la voix que tu veux utiliser. Les
        valeurs sont stockées uniquement en local dans cette application.
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
            style={{
              width: "100%",
              padding: "0.5rem 0.6rem",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(5,5,15,0.9)",
              color: "#f5f5f5",
              fontSize: "0.8rem"
            }}
          />
        </div>

        <div>
          <label
            htmlFor="eleven-voice-id"
            style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}
          >
            ID de la voix
          </label>
          <input
            id="eleven-voice-id"
            type="text"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            placeholder="voice_id..."
            style={{
              width: "100%",
              padding: "0.5rem 0.6rem",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(5,5,15,0.9)",
              color: "#f5f5f5",
              fontSize: "0.8rem"
            }}
          />
        </div>
      </div>

      <button
        type="button"
        className="twitch-button"
        style={{ marginTop: "0.9rem" }}
        onClick={handleSave}
      >
        Sauvegarder la configuration ElevenLabs
      </button>

      {saved && (
        <p className="card-text" style={{ marginTop: "0.4rem", color: "#7cf5a5" }}>
          Configuration sauvegardée localement.
        </p>
      )}
    </section>
  );
};

