import { useEffect, useState } from "react";
import { loadElevenLabsConfig, saveElevenLabsConfig } from "../../../elevenLabsConfig";
import { speakWithElevenLabsFromText } from "../../../elevenLabsApi";

type ModelOption = {
  id: string;
  label: string;
  description: string;
};

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "eleven_v3",
    label: "Eleven v3 (multilingue, expressif)",
    description: "Modèle le plus riche émotionnellement, 70+ langues."
  },
  {
    id: "eleven_multilingual_v2",
    label: "Eleven Multilingual v2",
    description: "Voix naturelle, 29 langues, très stable sur le long."
  },
  {
    id: "eleven_flash_v2_5",
    label: "Eleven Flash v2.5",
    description: "Très faible latence, 32 langues, jusqu'à 40k caractères."
  },
  {
    id: "eleven_turbo_v2_5",
    label: "Eleven Turbo v2.5",
    description: "Bon compromis qualité / vitesse, 32 langues."
  }
];

export const ElevenLabsVoiceCard = () => {
  const [modelId, setModelId] = useState("eleven_turbo_v2_5");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [useSpeakerBoost, setUseSpeakerBoost] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testText, setTestText] = useState("");

  useEffect(() => {
    const cfg = loadElevenLabsConfig();
    setModelId(cfg.modelId);
    setStability(cfg.stability);
    setSimilarityBoost(cfg.similarityBoost);
    setStyle(cfg.style);
    setSpeed(cfg.speed);
    setUseSpeakerBoost(cfg.useSpeakerBoost);
  }, []);

  const handleSave = () => {
    const existing = loadElevenLabsConfig();
    saveElevenLabsConfig({
      ...existing,
      modelId,
      stability,
      similarityBoost,
      style,
      speed,
      useSpeakerBoost
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = () => {
    void speakWithElevenLabsFromText(testText);
  };

  const isV3Model = modelId === "eleven_v3";

  return (
    <section className="card">
      <div className="card-title">Voix ElevenLabs</div>
      <p className="card-text">
        Choisis le modèle et les réglages de la voix. Les valeurs sont stockées en local et
        utilisées pour chaque TTS déclenché par une redeem.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginTop: "0.6rem" }}>
        <div>
          <label
            htmlFor="eleven-model"
            style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}
          >
            Modèle Text to Speech
          </label>
          <select
            id="eleven-model"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="field"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <small style={{ fontSize: "0.75rem", opacity: 0.75 }}>
            {MODEL_OPTIONS.find((m) => m.id === modelId)?.description}
          </small>
        </div>

        <div>
          <label
            htmlFor="eleven-speed"
            style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}
          >
            Vitesse de lecture ({speed.toFixed(2)})
          </label>
          <input
            id="eleven-speed"
            type="range"
            min={0.7}
            max={1.2}
            step={0.01}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <small style={{ fontSize: "0.75rem", opacity: 0.75 }}>
            1.0 = vitesse normale. 0.7 plus lent, 1.2 plus rapide.
          </small>
        </div>

        <div>
          <label
            htmlFor="eleven-stability"
            style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}
          >
            Stabilité ({(stability * 100).toFixed(0)}%)
          </label>
          <input
            id="eleven-stability"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={stability}
            onChange={(e) => setStability(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <small style={{ fontSize: "0.75rem", opacity: 0.75 }}>
            Plus la stabilité est basse, plus la voix est expressive mais variable. Plus elle est
            haute, plus la voix est régulière et neutre.
          </small>
        </div>

        <div>
          <label
            htmlFor="eleven-similarity"
            style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}
          >
            Similarité ({(similarityBoost * 100).toFixed(0)}%)
          </label>
          <input
            id="eleven-similarity"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={similarityBoost}
            onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <small style={{ fontSize: "0.75rem", opacity: 0.75 }}>
            Contrôle à quel point la synthèse colle à la voix d&apos;origine. Trop élevé sur une
            voix de mauvaise qualité peut faire ressortir les artefacts.
          </small>
        </div>

        <div>
          <label
            htmlFor="eleven-style"
            style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}
          >
            Style exaggeration ({(style * 100).toFixed(0)}%)
          </label>
          <input
            id="eleven-style"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={style}
            onChange={(e) => setStyle(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <small style={{ fontSize: "0.75rem", opacity: 0.75 }}>
            Amplifie le style de la voix source mais peut réduire la stabilité et augmenter la
            latence. Nous recommandons de laisser à 0 sauf besoin spécifique.
          </small>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.8rem",
            marginTop: "0.2rem"
          }}
        >
          <input
            type="checkbox"
            checked={useSpeakerBoost}
            onChange={(e) => setUseSpeakerBoost(e.target.checked)}
            disabled={isV3Model}
          />
          Activer Speaker Boost (légère hausse de latence)
        </label>

        <small style={{ fontSize: "0.75rem", opacity: 0.75 }}>
          Améliore légèrement la similarité à la voix source au prix d&apos;un peu plus de calcul et
          de latence.{" "}
          {isV3Model
            ? "Speaker Boost n'est pas disponible pour le modèle Eleven v3."
            : "Disponible pour les modèles autres que Eleven v3."}
        </small>

        <div style={{ marginTop: "0.4rem" }}>
          <label
            htmlFor="eleven-test-text"
            style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}
          >
            Texte de test TTS
          </label>
          <input
            id="eleven-test-text"
            type="text"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Saisis un texte pour tester la voix…"
            className="field"
          />
          <button
            type="button"
            className="twitch-button"
            style={{ marginTop: "0.6rem" }}
            onClick={handleTest}
            disabled={!testText.trim()}
          >
            Tester le texte avec la voix
          </button>
        </div>
      </div>

      <button
        type="button"
        className="twitch-button"
        style={{ marginTop: "0.9rem" }}
        onClick={handleSave}
      >
        Sauvegarder les réglages de voix
      </button>

      {saved && (
        <p className="card-text" style={{ marginTop: "0.4rem", color: "#7cf5a5" }}>
          Réglages de voix ElevenLabs sauvegardés.
        </p>
      )}
    </section>
  );
};

