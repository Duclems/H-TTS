import { useEffect, useState } from "react";
import {
  loadRewardVoiceConfig,
  saveRewardVoiceConfig,
  getDefaultRewardVoiceConfig,
  MODEL_OPTIONS,
  type RewardVoiceConfig
} from "../../../rewardVoiceConfig";
import { speakWithElevenLabsFromText, fetchElevenVoices } from "../../../elevenLabsApi";

type Props = {
  rewardId: string;
  rewardTitle: string;
  onClose: () => void;
};

export const RewardVoiceModal = ({ rewardId, rewardTitle, onClose }: Props) => {
  const [voiceId, setVoiceId] = useState("");
  const [voices, setVoices] = useState<{ voice_id: string; name: string }[]>([]);
  const [modelId, setModelId] = useState("eleven_turbo_v2_5");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [useSpeakerBoost, setUseSpeakerBoost] = useState(false);
  const [testText, setTestText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = loadRewardVoiceConfig(rewardId);
    if (existing) {
      setVoiceId(existing.voiceId);
      setModelId(existing.modelId);
      setStability(existing.stability);
      setSimilarityBoost(existing.similarityBoost);
      setStyle(existing.style);
      setSpeed(existing.speed);
      setUseSpeakerBoost(existing.useSpeakerBoost);
    } else {
      const def = getDefaultRewardVoiceConfig();
      setVoiceId(def.voiceId);
      setModelId(def.modelId);
      setStability(def.stability);
      setSimilarityBoost(def.similarityBoost);
      setStyle(def.style);
      setSpeed(def.speed);
      setUseSpeakerBoost(def.useSpeakerBoost);
    }

    void (async () => {
      const list = await fetchElevenVoices();
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, "fr-FR"));
      setVoices(sorted);
    })();
  }, [rewardId]);

  const getConfig = (): RewardVoiceConfig => ({
    voiceId: voiceId.trim(),
    modelId,
    stability,
    similarityBoost,
    style,
    useSpeakerBoost,
    speed
  });

  const handleSave = () => {
    saveRewardVoiceConfig(rewardId, getConfig());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1000);
  };

  const handleTest = () => {
    const cfg = getConfig();
    if (!cfg.voiceId) return;
    void speakWithElevenLabsFromText(testText.trim() || "Test de la voix.", cfg);
  };

  const isV3Model = modelId === "eleven_v3";

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-voice-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 id="reward-voice-modal-title" className="card-title" style={{ margin: 0 }}>
            Voix TTS — {rewardTitle}
          </h2>
          <button type="button" className="twitch-button" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="card-text" style={{ marginBottom: "0.75rem" }}>
          Configure la voix et les paramètres ElevenLabs pour ce reward. Les redemptions de ce reward
          utiliseront cette config pour le TTS.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div>
            <label htmlFor="rv-voice-id" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              Voix ElevenLabs
            </label>
            {voices.length > 0 ? (
              <select
                id="rv-voice-id"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="field"
              >
                <option value="">Choisir une voix…</option>
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="rv-voice-id"
                type="text"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                placeholder="Choisir une voix…"
                className="field"
              />
            )}
          </div>

          <div>
            <label htmlFor="rv-model" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              Modèle
            </label>
            <select id="rv-model" value={modelId} onChange={(e) => setModelId(e.target.value)} className="field">
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rv-speed" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              Vitesse ({speed.toFixed(2)})
            </label>
            <input
              id="rv-speed"
              type="range"
              min={0.7}
              max={1.2}
              step={0.01}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label htmlFor="rv-stability" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              Stabilité ({(stability * 100).toFixed(0)}%)
            </label>
            <input
              id="rv-stability"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={stability}
              onChange={(e) => setStability(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label htmlFor="rv-similarity" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              Similarité ({(similarityBoost * 100).toFixed(0)}%)
            </label>
            <input
              id="rv-similarity"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={similarityBoost}
              onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label htmlFor="rv-style" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              Style ({(style * 100).toFixed(0)}%)
            </label>
            <input
              id="rv-style"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={style}
              onChange={(e) => setStyle(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem" }}>
            <input
              type="checkbox"
              checked={useSpeakerBoost}
              onChange={(e) => setUseSpeakerBoost(e.target.checked)}
              disabled={isV3Model}
            />
            Speaker Boost {isV3Model && "(non dispo. pour Eleven v3)"}
          </label>

          <div>
            <label htmlFor="rv-test" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              Texte de test
            </label>
            <input
              id="rv-test"
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Saisis un texte pour tester…"
              className="field"
            />
            <button
              type="button"
              className="twitch-button"
              style={{ marginTop: "0.4rem" }}
              onClick={handleTest}
              disabled={!voiceId.trim()}
            >
              Tester la voix
            </button>
          </div>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="button" className="twitch-button" onClick={handleSave}>
            Enregistrer
          </button>
          {saved && (
            <span className="card-text text-success">
              Enregistré.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
