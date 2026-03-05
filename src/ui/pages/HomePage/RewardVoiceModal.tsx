import { useEffect, useState, type CSSProperties } from "react";
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
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

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

  const getRangeStyle = (value: number, min: number, max: number): CSSProperties =>
    ({
      "--range-fill": `${((value - min) / (max - min)) * 100}%`
    } as CSSProperties);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-voice-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="panel modal-content settings-modal-content reward-voice-modal"
        onClick={(e) => {
          e.stopPropagation();
          setVoiceOpen(false);
          setModelOpen(false);
        }}
      >
        <div className="settings-modal-header">
          <h2 id="reward-voice-modal-title" className="card-title">
            Voix TTS • {rewardTitle}
          </h2>
          <button
            type="button"
            className="settings-modal-close settings-modal-close-twitch"
            onClick={onClose}
            aria-label="Fermer"
          >
            <img src="/cross.svg" alt="Fermer" />
          </button>
        </div>

        <div className="reward-voice-modal-body">
          <div className="reward-voice-modal-fields">
            <div className="reward-voice-dropdown-wrap reward-voice-field-first">
              <label htmlFor="rv-voice-id" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
                Voix ElevenLabs
              </label>
              {voices.length > 0 ? (
                <>
                  <button
                    id="rv-voice-id"
                    type="button"
                    className="field reward-voice-dropdown-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVoiceOpen((v) => !v);
                      setModelOpen(false);
                    }}
                    aria-expanded={voiceOpen}
                    aria-haspopup="listbox"
                    aria-label="Choisir une voix"
                  >
                    {voices.find((v) => v.voice_id === voiceId)?.name ?? "Choisir une voix…"}
                  </button>
                  {voiceOpen && (
                    <ul
                      className="reward-voice-dropdown-list"
                      role="listbox"
                      aria-labelledby="rv-voice-id"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <li
                        role="option"
                        aria-selected={!voiceId}
                        className="reward-voice-dropdown-option"
                        onClick={() => {
                          setVoiceId("");
                          setVoiceOpen(false);
                        }}
                      >
                        Choisir une voix…
                      </li>
                      {voices.map((v) => (
                        <li
                          key={v.voice_id}
                          role="option"
                          aria-selected={voiceId === v.voice_id}
                          className="reward-voice-dropdown-option"
                          onClick={() => {
                            setVoiceId(v.voice_id);
                            setVoiceOpen(false);
                          }}
                        >
                          {v.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
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

            <div className="reward-voice-dropdown-wrap">
              <label htmlFor="rv-model" style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
                Modèle
              </label>
              <button
                id="rv-model"
                type="button"
                className="field reward-voice-dropdown-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setModelOpen((v) => !v);
                  setVoiceOpen(false);
                }}
                aria-expanded={modelOpen}
                aria-haspopup="listbox"
                aria-label="Choisir un modèle"
              >
                {MODEL_OPTIONS.find((m) => m.id === modelId)?.label ?? modelId}
              </button>
              {modelOpen && (
                <ul
                  className="reward-voice-dropdown-list"
                  role="listbox"
                  aria-labelledby="rv-model"
                  onClick={(e) => e.stopPropagation()}
                >
                  {MODEL_OPTIONS.map((m) => (
                    <li
                      key={m.id}
                      role="option"
                      aria-selected={modelId === m.id}
                      className="reward-voice-dropdown-option"
                      onClick={() => {
                        setModelId(m.id);
                        setModelOpen(false);
                      }}
                    >
                      {m.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="reward-voice-range-grid">
              <div className="reward-voice-range-item">
                <label htmlFor="rv-speed" className="reward-voice-range-label">
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
                  className="reward-voice-range"
                  style={getRangeStyle(speed, 0.7, 1.2)}
                />
              </div>
              <div className="reward-voice-range-item">
                <label htmlFor="rv-stability" className="reward-voice-range-label">
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
                  className="reward-voice-range"
                  style={getRangeStyle(stability, 0, 1)}
                />
              </div>
              <div className="reward-voice-range-item">
                <label htmlFor="rv-similarity" className="reward-voice-range-label">
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
                  className="reward-voice-range"
                  style={getRangeStyle(similarityBoost, 0, 1)}
                />
              </div>
              <div className="reward-voice-range-item">
                <label htmlFor="rv-style" className="reward-voice-range-label">
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
                  className="reward-voice-range"
                  style={getRangeStyle(style, 0, 1)}
                />
              </div>
            </div>

            <label className="reward-voice-switch">
              <input
                type="checkbox"
                checked={useSpeakerBoost}
                onChange={(e) => setUseSpeakerBoost(e.target.checked)}
                disabled={isV3Model}
                aria-describedby="rv-speaker-label"
              />
              <span className="reward-voice-switch-slider" aria-hidden />
              <span id="rv-speaker-label" className="reward-voice-switch-label">
                Speaker Boost {isV3Model && "(non dispo. pour Eleven v3)"}
              </span>
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
                className="field reward-voice-input"
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
        </div>

        <div className="reward-voice-modal-footer">
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
